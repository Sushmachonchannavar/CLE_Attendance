require('dotenv').config();
const { sendVerification } = require('./utils/sms');

async function test() {
    console.log("Testing Twilio with API Key...");
    console.log("SID:", process.env.TWILIO_API_KEY);
    const res = await sendVerification('+919876543210');
    console.log("Result:", res);
}
test();
