// Small Standard MIDI File reader/writer for reproducible, offline music preparation.
export function readMidi(bytes) {
  if(bytes.toString('ascii',0,4)!=='MThd'||bytes.readUInt32BE(4)!==6)throw Error('Invalid MIDI header');
  const division=bytes.readUInt16BE(12);if(division&0x8000)throw Error('SMPTE timing is not supported');
  const tracks=[];let offset=14;
  for(let n=0;n<bytes.readUInt16BE(10);n++){
    if(bytes.toString('ascii',offset,offset+4)!=='MTrk')throw Error('Missing MIDI track');
    const end=offset+8+bytes.readUInt32BE(offset+4);offset+=8;let tick=0,running=0;const events=[];
    const vlq=()=>{let value=0,b,count=0;do{if(offset>=end||++count>4)throw Error('Invalid MIDI VLQ');b=bytes[offset++];value=(value<<7)|(b&127);}while(b&128);return value;};
    while(offset<end){
      tick+=vlq();let status=bytes[offset];if(status&128){offset++;if(status<240)running=status;}else status=running;
      if(status===255){const type=bytes[offset++],length=vlq();events.push({tick,status,type,data:bytes.subarray(offset,offset+length)});offset+=length;}
      else if(status===240||status===247){const length=vlq();events.push({tick,status,data:bytes.subarray(offset,offset+length)});offset+=length;}
      else if(status>=128&&status<240){const length=[192,208].includes(status&240)?1:2;events.push({tick,status,data:bytes.subarray(offset,offset+length)});offset+=length;}
      else throw Error('Invalid MIDI status');
    }
    if(offset!==end)throw Error('Invalid MIDI track length');tracks.push(events);
  }
  return {division,tracks};
}
function vlq(value){const bytes=[value&127];while(value>>=7)bytes.unshift((value&127)|128);return Buffer.from(bytes);}
export function writeMidi({division,tracks}){
  const header=Buffer.alloc(14);header.write('MThd');header.writeUInt32BE(6,4);header.writeUInt16BE(tracks.length>1?1:0,8);header.writeUInt16BE(tracks.length,10);header.writeUInt16BE(division,12);
  return Buffer.concat([header,...tracks.map(events=>{
    let previous=0;const parts=[];
    for(const event of events){if(event.tick<previous)throw Error('Unsorted MIDI events');parts.push(vlq(event.tick-previous),Buffer.from([event.status]));previous=event.tick;
      if(event.status===255)parts.push(Buffer.from([event.type]),vlq(event.data.length));
      else if(event.status>=240)parts.push(vlq(event.data.length));parts.push(Buffer.from(event.data));
    }
    const data=Buffer.concat(parts),header=Buffer.alloc(8);header.write('MTrk');header.writeUInt32BE(data.length,4);return Buffer.concat([header,data]);
  })]);
}
