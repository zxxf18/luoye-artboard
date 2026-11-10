import test from 'node:test';
import assert from 'node:assert/strict';
import { buildIndex } from '../tools/build.mjs';
import { supportLinks } from '../src/ui/support-links.js';
test('store builds disable both links and remove tracking', () => {
 const html=buildIndex('<html lang="zh-CN"><head></head><body></body></html>',{client:true,distribution:'store'});
 assert.match(html,/data-project-link="false"/);
 assert.match(html,/data-donation-link="false"/);
});
test('support links render no empty row or dangling separator', () => {
 assert.equal(supportLinks({project:false,donation:false}), '');
 for(const options of [{project:true,donation:false},{project:false,donation:true}]){
  const html=supportLinks(options);assert.equal((html.match(/<a /g)||[]).length,1);assert.doesNotMatch(html,/about-links-sep/);
 }
 assert.match(supportLinks(),/about-links-sep/);
});
test('each link may be independently enabled for a distribution', () => {
 const html=buildIndex('<html></html>',{distribution:'store',showProjectLink:true,showDonationLink:false});
 assert.match(html,/data-project-link="true"/);assert.match(html,/data-donation-link="false"/);
});
