// Looking after the community from the command line (uses DATABASE_URL):
//   npm run moderate -w @quilt/server                  the reported quilts
//   npm run moderate -w @quilt/server hide <id>        takes a shared quilt down
//   npm run moderate -w @quilt/server show <id>        puts it back and forgets its reports
//   npm run moderate -w @quilt/server block <id>       stops the quilt's owner sharing, takes down all their quilts
//   npm run moderate -w @quilt/server unblock <id>     lets them share again
import { createPool } from '../src/db.js';
import { reported, setBlocked, setHidden } from '../src/moderation.js';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set (see server/.env.example)');
const pool = createPool(process.env.DATABASE_URL);
const [what, id] = process.argv.slice(2);
try {
  if (!what) {
    const rows = await reported(pool);
    for (const r of rows)
      console.log(
        `${r.id}  ${r.hidden ? 'hidden' : 'shown '}  ${r.reports} × ${r.reasons.join(', ')}  “${r.name}” by ${r.author}`,
      );
    if (!rows.length) console.log('Nothing reported.');
  } else {
    const act = { hide: setHidden, show: setHidden, block: setBlocked, unblock: setBlocked }[what];
    if (!act || !id) throw new Error('Use: moderate [hide | show | block | unblock] <shared quilt id>');
    const found = await act(pool, id, what === 'hide' || what === 'block');
    console.log(found ? 'Done.' : 'No shared quilt with that id.');
  }
} finally {
  await pool.end();
}
