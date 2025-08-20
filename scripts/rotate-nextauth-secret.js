#!/usr/bin/env node

const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

// Function to generate a secure random secret
function generateSecret(length = 32) {
  return crypto.randomBytes(length).toString('base64url');
}

// Function to update or add NEXTAUTH_SECRET in .env file
function updateEnvFile(envFilePath) {
  try {
    // Read the existing .env file or create a new one
    let envContent = '';
    if (fs.existsSync(envFilePath)) {
      envContent = fs.readFileSync(envFilePath, 'utf8');
    }

    const secret = generateSecret();
    const secretLine = `NEXTAUTH_SECRET=${secret}`;

    // Check if NEXTAUTH_SECRET already exists
    if (envContent.includes('NEXTAUTH_SECRET=')) {
      // Replace existing NEXTAUTH_SECRET
      envContent = envContent.replace(/NEXTAUTH_SECRET=.*/g, secretLine);
      console.log('✅ Updated NEXTAUTH_SECRET in .env file');
    } else {
      // Add NEXTAUTH_SECRET to the file
      if (envContent && !envContent.endsWith('\n')) {
        envContent += '\n';
      }
      envContent += `${secretLine}\n`;
      console.log('✅ Added NEXTAUTH_SECRET to .env file');
    }

    // Write the updated content back to the file
    fs.writeFileSync(envFilePath, envContent);
    console.log(`🔐 NEXTAUTH_SECRET has been set to a secure random value in ${envFilePath}`);
  } catch (error) {
    console.error('❌ Error updating .env file:', error.message);
    process.exit(1);
  }
}

// Main execution
function main() {
  // Use .env.local as default, fallback to .env
  const envFile = fs.existsSync('.env.local') ? '.env.local' : '.env';
  
  // If neither .env.local nor .env exists, create .env.local
  const envFilePath = path.resolve(envFile);
  
  console.log(`🔄 Generating secure NEXTAUTH_SECRET...`);
  updateEnvFile(envFilePath);
  console.log('✅ NEXTAUTH_SECRET rotation completed!');
}

main();