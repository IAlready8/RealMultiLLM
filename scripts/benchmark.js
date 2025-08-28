#!/usr/bin/env node
// RealMultiLLM Benchmark Script
// 3-STEP PLAN:
// 1. Measure memory usage and response time for key operations
// 2. Report performance metrics to help identify bottlenecks
// 3. Provide recommendations for optimization

const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

// Print system info
console.log('📊 RealMultiLLM Performance Benchmark');
console.log('======================================');

console.log('\n📱 System Information:');
try {
  const osInfo = execSync('system_profiler SPHardwareDataType | grep "Model\\|Memory"').toString();
  console.log(osInfo);
} catch (error) {
  console.log('Could not retrieve system information');
}

// Measure memory usage during build
console.log('\n🏗️ Measuring build performance...');

function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Check node_modules size
const getDirectorySize = (directoryPath) => {
  const files = fs.readdirSync(directoryPath);
  let size = 0;

  for (const file of files) {
    const filePath = path.join(directoryPath, file);
    const stats = fs.statSync(filePath);
    
    if (stats.isDirectory()) {
      size += getDirectorySize(filePath);
    } else {
      size += stats.size;
    }
  }

  return size;
};

try {
  console.log('\n📦 Dependencies size:');
  const nodeModulesSize = getDirectorySize('./node_modules');
  console.log(`node_modules: ${formatBytes(nodeModulesSize)}`);
} catch (error) {
  console.log('Could not measure node_modules size:', error.message);
}

// Run a test build with timing
console.log('\n⏱️ Build time measurement:');
try {
  console.time('Build time');
  execSync('npm run build', { stdio: 'inherit' });
  console.timeEnd('Build time');
  
  // Check build output size
  console.log('\n📊 Build output size:');
  const dotNextSize = getDirectorySize('./.next');
  console.log(`.next directory: ${formatBytes(dotNextSize)}`);
} catch (error) {
  console.log('Build measurement failed:', error.message);
}

// Memory recommendations
console.log('\n🔧 Performance recommendations:');
if (nodeModulesSize > 500 * 1024 * 1024) {
  console.log('⚠️ Large node_modules folder detected. Consider:');
  console.log('  - Running npm prune to remove unused dependencies');
  console.log('  - Using smaller alternatives for large packages');
}

// Final recommendations
console.log('\n📝 General recommendations for your hardware:');
console.log('1. Use the clean script before builds: npm run clean');
console.log('2. Close other applications during development and builds');
console.log('3. Consider setting up swap space if you experience memory issues');
console.log('4. For M2 MacBook Air (8GB), limit other memory-intensive processes');
console.log('5. Use streaming responses when dealing with large LLM outputs');

console.log('\n✅ Benchmark completed');
