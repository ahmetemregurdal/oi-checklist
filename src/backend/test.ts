import { ojuz } from '@bridge';
import { db } from '@db';

async function main() {
  let cookie = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhdXRoMHw2NzRhMjhkOTQzMThhMjc0OTA5NWFiNzkiLCJlbWFpbCI6ImF2aWdobmFrY0BnbWFpbC5jb20iLCJydGsiOiJRX0NzSTJFZlBaYTNsd0pXNFVYakdfd3M3YmtHWERfdzQ0QTVzZW52bnU0bkYiLCJydGtleHAiOjE3NjEwNDAwMTgsInNzbmV4cCI6MTc2MTEyMDU0Mn0.KehTAhb7mr_wsrLHungdSAamwkQkTHaoqxRWdDFCYac';
  let problem = await db.problem.findFirst({ where: { name: 'Hack!' }, include: { problemLinks: true } });
  let verifyRes = await ojuz.verify(cookie);
  if (verifyRes.error) {
    console.error(verifyRes.error);
    process.exit(1);
  }
  let username = verifyRes.username;
  console.log(`Username: ${username}`);
  let score = await ojuz.fetchScores(cookie, username, [problem]);
  if (score.error) {
    console.error(score.error);
    process.exit(1);
  }
  console.log(`Score: ${score.scores[0].score}/100`);
}

main().then(() => {
  console.log('hi');
});