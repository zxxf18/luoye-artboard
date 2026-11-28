import { build } from './build.mjs';
import { parseArgs } from 'node:util';

const { values } = parseArgs({ options: {
 store: { type: 'boolean' },
 output: { type: 'string' },
 'project-link': { type: 'string' },
 'donation-link': { type: 'string' },
} });
function toggle(name) {
 const value = values[name];
 if (value === undefined) return undefined;
 if (!['on','off'].includes(value)) throw new Error(`${name} must be on or off`);
 return value==='on';
}
await build({ client: true, output: values.output, distribution: values.store ? 'store' : 'community',
 showProjectLink:toggle('project-link'),showDonationLink:toggle('donation-link') });
