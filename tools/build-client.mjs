import { build } from './build.mjs';

const args=process.argv.slice(2);
function toggle(name) {
 const values=args.filter(arg=>arg.startsWith(`--${name}=`));
 if (!values.length) return undefined;
 const value=values.at(-1).split('=')[1];
 if (!['on','off'].includes(value)) throw new Error(`${name} must be on or off`);
 return value==='on';
}
await build({ client: true, distribution: args.includes('--store') ? 'store' : 'community',
 showProjectLink:toggle('project-link'),showDonationLink:toggle('donation-link') });
