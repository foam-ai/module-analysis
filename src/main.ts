import { createModuleMap } from './module-map';
import { saveMapAsYaml } from './utils';
import * as path from 'path';

/**
 * Main function to run the example
 */
async function main() {
  try {
    // Path to one of the cloned repositories
    // Use the ts-pattern directory in the current project
    const repoPath = path.resolve(__dirname, '../demoapp');

    console.log(`Analyzing TypeScript modules in ${repoPath}...`);

    // Create module map
    const moduleMap = await createModuleMap(repoPath);
    console.log(JSON.stringify(moduleMap, null, 2));

    // Save as YAML
    const outputPath = path.resolve(__dirname, '../map.yml');
    saveMapAsYaml(moduleMap, outputPath);

    console.log(`Module map generated successfully and saved to ${outputPath}`);
    console.log(`Total modules analyzed: ${Object.keys(moduleMap.modules).length}`);

    // Print a sample of the module map
    const sampleModule = Object.keys(moduleMap.modules)[0];
    if (sampleModule) {
      console.log('\nSample module information:');
      console.log(`Module: ${sampleModule}`);
      console.log(`Description: ${moduleMap.modules[sampleModule].description}`);

      const callingModules = Object.keys(moduleMap.modules[sampleModule].calling);
      if (callingModules.length > 0) {
        console.log('Calls:');
        callingModules.slice(0, 3).forEach(module => {
          console.log(`  - ${module}: ${moduleMap.modules[sampleModule].calling[module].substring(0, 100)}...`);
        });
      }

      const callerModules = Object.keys(moduleMap.modules[sampleModule].callers);
      if (callerModules.length > 0) {
        console.log('Called by:');
        callerModules.slice(0, 3).forEach(module => {
          console.log(`  - ${module}: ${moduleMap.modules[sampleModule].callers[module].substring(0, 100)}...`);
        });
      }
    }
  } catch (error) {
    console.error('Error generating module map:', error);
    process.exit(1);
  }
}

// Run the main function
main();