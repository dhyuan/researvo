APPLE_TEAM_ID="G64477NYC5" \
APPLE_KEY_ID="Q792B5A97W" \
APPLE_CLIENT_ID="xyz.researvo.web" \
APPLE_PRIVATE_KEY_PATH="/Users/dhyuan/github/dhyuan/humansignal/Apple_ResearvoApp_AuthKey_Q792B5A97W.p8" \
node --input-type=module -e '
import { readFileSync } from "node:fs";
import { createPrivateKey } from "node:crypto";
import { SignJWT } from "jose";

const teamId = process.env.APPLE_TEAM_ID;
const keyId = process.env.APPLE_KEY_ID;
const clientId = process.env.APPLE_CLIENT_ID;
const privateKeyPath = process.env.APPLE_PRIVATE_KEY_PATH;

const privateKey = createPrivateKey(readFileSync(privateKeyPath, "utf8"));
const now = Math.floor(Date.now() / 1000);
const exp = now + 60 * 60 * 24 * 180;

const token = await new SignJWT({})
  .setProtectedHeader({ alg: "ES256", kid: keyId })
  .setIssuer(teamId)
  .setIssuedAt(now)
  .setExpirationTime(exp)
  .setAudience("https://appleid.apple.com")
  .setSubject(clientId)
  .sign(privateKey);

console.log(token);
'
