/**
 * One-shot script: register the Linked Roles metadata schema with Discord.
 *
 * Run this ONCE before users start verifying:
 *   npm run register
 *
 * After running, go to your Discord server → Server Settings → Linked Roles
 * and create a new Linked Role using the "Roblox Verified" requirement.
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { registerMetadata } = require('../src/utils/discord');

(async () => {
  const required = ['DISCORD_CLIENT_ID', 'DISCORD_BOT_TOKEN'];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) {
    console.error(`❌ Missing environment variables: ${missing.join(', ')}`);
    console.error('   Copy .env.example → .env and fill in the values.');
    process.exit(1);
  }

  console.log('⏳ Registering Discord Role Connection metadata schema…');
  try {
    const result = await registerMetadata();
    console.log('✅ Metadata registered successfully!\n');
    console.log(JSON.stringify(result, null, 2));
    console.log(
      '\nNext: Go to your Discord server → Server Settings → Linked Roles → Create Linked Role'
    );
    console.log('      and set "Roblox Verified is equal to True" as the requirement.');
  } catch (err) {
    console.error('❌ Registration failed:', err?.response?.data ?? err.message);
    process.exit(1);
  }
})();
