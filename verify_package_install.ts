
import { logger } from './src/index';

console.log('--- Verifying External Package Installation ---');

async function testExternalPackage() {
  try {
    console.log('Attempting to import lodash...');
    // We will try to install it first via command line, but here we assume it's available or we check if we can require it.
    // Since this is a test script, we'll try dynamic import.
    
    // Note: In a real scenario, user would run `bun add lodash`
    // We will simulate the check.
    
    const _ = await import('lodash');
    
    const array = [1, 2, 3, 4, 5];
    const chunked = _.chunk(array, 2);
    
    console.log('Lodash _.chunk result:', chunked);
    
    if (JSON.stringify(chunked) === '[[1,2],[3,4],[5]]') {
        console.log('SUCCESS: External package (lodash) is working correctly!');
    } else {
        console.error('FAILURE: Lodash did not produce expected output.');
    }

  } catch (error) {
    console.error('Error with external package:', error);
    console.log('Note: Ensure you run "bun add lodash" before running this script if it fails due to missing module.');
  }
}

testExternalPackage();
