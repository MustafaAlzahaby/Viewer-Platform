// Script to sync viewer from submodule to main project
// This preserves customizations for project data integration

const fs = require('fs');
const path = require('path');

const viewerSrc = path.join(__dirname, 'viewer-src', 'src');
const targetMain = path.join(__dirname, 'src', 'main');
const targetCore = path.join(__dirname, 'src', 'core');

// Customizations to preserve
const customizations = {
  'BimViewerApp.ts': {
    file: path.join(targetMain, 'BimViewerApp.ts'),
    // Lines that read project data from sessionStorage
    preserve: [
      '// Read project data from sessionStorage',
      'const projectData = (window as any).currentProject',
      'const configPath = projectData.config_url',
      'const excelPath = projectData.excel_url',
      'const guidsPath = projectData.guids_url'
    ]
  },
  'ModelManager.ts': {
    file: path.join(targetCore, 'ModelManager.ts'),
    // Lines that load model from project data
    preserve: [
      '// Read project data from sessionStorage',
      'if (projectData.model_url)',
      'fragPaths = [projectData.model_url]'
    ]
  }
};

function copyDirectory(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  
  const entries = fs.readdirSync(src, { withFileTypes: true });
  
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    
    if (entry.isDirectory()) {
      copyDirectory(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
      console.log(`Copied: ${entry.name}`);
    }
  }
}

function applyCustomizations() {
  console.log('\nApplying customizations...');
  
  // Read BimViewerApp.ts and add project data reading
  const bimViewerPath = path.join(targetMain, 'BimViewerApp.ts');
  if (fs.existsSync(bimViewerPath)) {
    let content = fs.readFileSync(bimViewerPath, 'utf8');
    
    // Check if customization already exists
    if (!content.includes('Read project data from sessionStorage')) {
      // Find the controller.initialize call and add project data reading before it
      const initPattern = /await this\.controller\.initialize\(/;
      if (initPattern.test(content)) {
        const projectDataCode = `
    // Read project data from sessionStorage (set by parent window)
    const projectData = (window as any).currentProject || JSON.parse(sessionStorage.getItem('currentProject') || '{}');
    const configPath = projectData.config_url || "./config.json";
    const excelPath = projectData.excel_url || "./excel-sheet/data.xlsx";
    const guidsPath = projectData.guids_url || "./guids/guids.json";
    
    console.log('[BimViewerApp] Loading project:', projectData.name);
    console.log('[BimViewerApp] Config:', configPath);
    console.log('[BimViewerApp] Excel:', excelPath);
    console.log('[BimViewerApp] Guids:', guidsPath);

    `;
        content = content.replace(initPattern, projectDataCode + '    await this.controller.initialize(');
        
        // Also update the initialize call to use the variables
        content = content.replace(
          /await this\.controller\.initialize\(\s*"\.\/config\.json",\s*"\.\/excel-sheet\/data\.xlsx",\s*"\.\/guids\/guids\.json"\s*\)/,
          'await this.controller.initialize(\n      configPath,\n      excelPath,\n      guidsPath\n    )'
        );
        
        // Update Excel panel loading to use excelPath
        const excelPattern = /await this\.excelPanel\.loadExcelData\(\s*"\.\/excel-sheet\/data\.xlsx",/;
        if (excelPattern.test(content)) {
          content = content.replace(excelPattern, 'await this.excelPanel.loadExcelData(\n      excelPath,');
        }
        
        fs.writeFileSync(bimViewerPath, content, 'utf8');
        console.log('✓ Applied BimViewerApp customizations');
      }
    } else {
      console.log('✓ BimViewerApp customizations already present');
    }
  }
  
  // Read ModelManager.ts and add project model loading
  const modelManagerPath = path.join(targetCore, 'ModelManager.ts');
  if (fs.existsSync(modelManagerPath)) {
    let content = fs.readFileSync(modelManagerPath, 'utf8');
    
    // Check if customization already exists
    if (!content.includes('Read project data from sessionStorage')) {
      // Find the fragPaths declaration and replace with project data reading
      const fragPathsPattern = /const fragPaths = \[.*?\];/s;
      if (fragPathsPattern.test(content)) {
        const projectModelCode = `    // Read project data from sessionStorage (set by parent window)
    const projectData = (window as any).currentProject || JSON.parse(sessionStorage.getItem('currentProject') || '{}');
    
    let fragPaths: string[] = [];
    
    if (projectData.model_url) {
      // If project has a model_url, use it
      // Support both single file and array of files
      if (Array.isArray(projectData.model_url)) {
        fragPaths = projectData.model_url;
      } else {
        fragPaths = [projectData.model_url];
      }
      console.log('[ModelManager] Loading model from project:', fragPaths);
    } else {
      // Fallback to default models
      fragPaths = ["models/z5.frag", "models/z2.frag", "models/z3.frag", "models/z4.frag", "models/z1.frag"];
      console.log('[ModelManager] Using default models:', fragPaths);
    }`;
        
        content = content.replace(fragPathsPattern, projectModelCode);
        
        // Add error handling to the load loop
        const loadPattern = /const file = await fetch\(path\);\s*const buffer = await file\.arrayBuffer\(\);/;
        if (loadPattern.test(content)) {
          content = content.replace(
            loadPattern,
            `try {
          const file = await fetch(path);
          if (!file.ok) {
            console.warn(\`[ModelManager] Failed to load \${path}: \${file.statusText}\`);
            return null;
          }
          const buffer = await file.arrayBuffer();`
          );
          
          // Add closing brace for try-catch
          const returnPattern = /return fragments\.core\.load\(buffer, \{ modelId \}\);/;
          content = content.replace(
            returnPattern,
            `          this.modelIds.push(modelId); // Save the modelId
          return fragments.core.load(buffer, { modelId });
        } catch (error) {
          console.error(\`[ModelManager] Error loading \${path}:\`, error);
          return null;
        }`
          );
        }
        
        fs.writeFileSync(modelManagerPath, content, 'utf8');
        console.log('✓ Applied ModelManager customizations');
      }
    } else {
      console.log('✓ ModelManager customizations already present');
    }
  }
}

// Main sync process
console.log('Syncing viewer from submodule...\n');

if (!fs.existsSync(viewerSrc)) {
  console.error('Error: viewer-src directory not found. Make sure the submodule is initialized:');
  console.error('  git submodule update --init --recursive');
  process.exit(1);
}

// Copy main files
console.log('Copying main files...');
if (fs.existsSync(path.join(viewerSrc, 'main'))) {
  copyDirectory(path.join(viewerSrc, 'main'), targetMain);
}

// Copy core files
console.log('\nCopying core files...');
if (fs.existsSync(path.join(viewerSrc, 'core'))) {
  copyDirectory(path.join(viewerSrc, 'core'), targetCore);
}

// Copy other directories if they exist
const otherDirs = ['types', 'utils', 'constants'];
for (const dir of otherDirs) {
  const srcDir = path.join(viewerSrc, dir);
  const destDir = path.join(__dirname, 'src', dir);
  if (fs.existsSync(srcDir)) {
    console.log(`\nCopying ${dir} files...`);
    copyDirectory(srcDir, destDir);
  }
}

// Apply customizations
applyCustomizations();

console.log('\n✓ Viewer sync complete!');
console.log('The viewer has been updated with your latest changes from the fragment2.0 branch.');

