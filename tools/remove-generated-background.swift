import Foundation
import CoreImage
import ImageIO
import UniformTypeIdentifiers
import Vision

enum CutoutError: Error, CustomStringConvertible {
    case usage
    case load(String)
    case noForeground(String)
    case render(String)

    var description: String {
        switch self {
        case .usage: return "usage: remove-generated-background input.png output.png"
        case .load(let path): return "cannot load image: \(path)"
        case .noForeground(let path): return "Vision found no foreground: \(path)"
        case .render(let path): return "cannot render PNG: \(path)"
        }
    }
}

func cutout(input: URL, output: URL) throws {
    guard let source = CGImageSourceCreateWithURL(input as CFURL, nil),
          let image = CGImageSourceCreateImageAtIndex(source, 0, nil) else {
        throw CutoutError.load(input.path)
    }

    let request = VNGenerateForegroundInstanceMaskRequest()
    let handler = VNImageRequestHandler(cgImage: image)
    try handler.perform([request])
    guard let observation = request.results?.first,
          !observation.allInstances.isEmpty else {
        throw CutoutError.noForeground(input.path)
    }
    let maskBuffer = try observation.generateScaledMaskForImage(
        forInstances: observation.allInstances,
        from: handler
    )

    let context = CIContext(options: [.useSoftwareRenderer: false])
    let foreground = CIImage(cgImage: image)
    let mask = CIImage(cvPixelBuffer: maskBuffer)
    let clear = CIImage(color: .clear).cropped(to: foreground.extent)
    guard let filter = CIFilter(name: "CIBlendWithMask") else {
        throw CutoutError.render(output.path)
    }
    filter.setValue(foreground, forKey: kCIInputImageKey)
    filter.setValue(clear, forKey: kCIInputBackgroundImageKey)
    filter.setValue(mask, forKey: kCIInputMaskImageKey)
    guard let composed = filter.outputImage,
          let rendered = context.createCGImage(composed, from: foreground.extent),
          let destination = CGImageDestinationCreateWithURL(
            output as CFURL,
            UTType.png.identifier as CFString,
            1,
            nil
          ) else {
        throw CutoutError.render(output.path)
    }
    CGImageDestinationAddImage(destination, rendered, nil)
    guard CGImageDestinationFinalize(destination) else {
        throw CutoutError.render(output.path)
    }
}

func runBatch(auditPath: String, jobsPath: String) throws {
    let auditData = try Data(contentsOf: URL(fileURLWithPath: auditPath))
    let jobsData = try Data(contentsOf: URL(fileURLWithPath: jobsPath))
    let audit = try JSONSerialization.jsonObject(with: auditData) as! [String: Any]
    let jobs = try JSONSerialization.jsonObject(with: jobsData) as! [[String: Any]]
    let masters = Dictionary(uniqueKeysWithValues: jobs.compactMap { job -> (String, String)? in
        guard let id = job["id"] as? String, let master = job["master"] as? String else { return nil }
        return (id, master)
    })
    let failures = (audit["failures"] as? [[String: Any]] ?? []).filter {
        ($0["reason"] as? String)?.hasPrefix("alpha range") == true
    }
    var unresolved: [[String: String]] = []
    for (index, failure) in failures.enumerated() {
        guard let id = failure["id"] as? String, let path = masters[id] else { continue }
        let input = URL(fileURLWithPath: path)
        let temporary = input.deletingLastPathComponent().appendingPathComponent(".\(id).vision.png")
        let result: Result<Void, Error> = autoreleasepool {
            Result { try cutout(input: input, output: temporary) }
        }
        switch result {
        case .success:
            let data = try Data(contentsOf: temporary)
            try data.write(to: input, options: .atomic)
            try? FileManager.default.removeItem(at: temporary)
        case .failure(let error):
            try? FileManager.default.removeItem(at: temporary)
            unresolved.append(["id": id, "reason": String(describing: error)])
        }
        if (index + 1) % 25 == 0 || index + 1 == failures.count {
            print("processed \(index + 1)/\(failures.count), unresolved \(unresolved.count)")
            fflush(stdout)
        }
    }
    let report = try JSONSerialization.data(withJSONObject: unresolved, options: [.prettyPrinted, .sortedKeys])
    try report.write(to: URL(fileURLWithPath: "design/evidence/v1.6/vision-unresolved.json"), options: .atomic)
}

do {
    if CommandLine.arguments.count == 4, CommandLine.arguments[1] == "--audit" {
        try runBatch(auditPath: CommandLine.arguments[2], jobsPath: CommandLine.arguments[3])
    } else {
        guard CommandLine.arguments.count == 3 else { throw CutoutError.usage }
        try cutout(
            input: URL(fileURLWithPath: CommandLine.arguments[1]),
            output: URL(fileURLWithPath: CommandLine.arguments[2])
        )
    }
} catch {
    fputs("\(error)\n", stderr)
    exit(1)
}
