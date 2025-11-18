# Viewer Integration Guide

This project uses a **git submodule** to integrate the viewer from the [RME-RT-Viewer repository](https://github.com/MustafaAlzahaby/RME-RT-Viewer.git) (branch: `fragment2.0`).

## Setup

The viewer is integrated as a git submodule located in `viewer-src/`. The submodule automatically tracks the `fragment2.0` branch.

## Updating the Viewer

When you make changes to the viewer in the `RME-RT-Viewer` repository and want to update this project:

### Option 1: Update from Remote (Recommended)
```bash
npm run update-viewer
```

This command will:
1. Pull the latest changes from the `fragment2.0` branch
2. Copy all viewer files to `src/main/` and `src/core/`
3. Automatically apply customizations for project data integration

### Option 2: Manual Update
```bash
# Update the submodule
git submodule update --remote viewer-src

# Sync files and apply customizations
npm run sync-viewer
```

## How It Works

1. **Submodule**: The viewer code lives in `viewer-src/` as a git submodule pointing to the `fragment2.0` branch
2. **Sync Script**: `sync-viewer.cjs` copies files from `viewer-src/src/` to `src/main/` and `src/core/`
3. **Customizations**: The sync script automatically applies necessary customizations:
   - **BimViewerApp.ts**: Reads project data from `sessionStorage` (set by the dashboard)
   - **ModelManager.ts**: Loads models from project's `model_url` instead of hardcoded paths

## Customizations Applied

The sync script preserves these integrations:

### BimViewerApp.ts
- Reads `currentProject` from `sessionStorage` or `window.currentProject`
- Uses `project.config_url`, `project.excel_url`, `project.guids_url` if available
- Falls back to default paths if project data is missing

### ModelManager.ts
- Reads `project.model_url` from project data
- Supports both single file and array of model files
- Falls back to default models if `model_url` is not provided

## Initial Setup (First Time)

If you're cloning this repository for the first time:

```bash
# Initialize and update submodules
git submodule update --init --recursive

# Sync the viewer files
npm run sync-viewer
```

## File Structure

```
Viewer-Platform/
├── viewer-src/              # Git submodule (RME-RT-Viewer @ fragment2.0)
│   └── src/
│       ├── main/
│       ├── core/
│       └── ...
├── src/
│   ├── main/                # Synced from viewer-src/src/main/
│   ├── core/                # Synced from viewer-src/src/core/
│   └── ...
├── sync-viewer.cjs          # Sync script
└── package.json              # Contains sync scripts
```

## Important Notes

- **Never edit files directly in `viewer-src/`** - Make changes in the original RME-RT-Viewer repository
- **Customizations are auto-applied** - The sync script handles project data integration automatically
- **Always run `npm run sync-viewer`** after updating the submodule to apply customizations

## Troubleshooting

### Submodule not initialized
```bash
git submodule update --init --recursive
```

### Wrong branch in submodule
```bash
cd viewer-src
git checkout fragment2.0
cd ..
npm run sync-viewer
```

### Customizations not applied
The sync script should automatically apply customizations. If they're missing, check:
1. The script ran successfully (`npm run sync-viewer`)
2. Files in `src/main/BimViewerApp.ts` contain "Read project data from sessionStorage"
3. Files in `src/core/ModelManager.ts` contain "Read project data from sessionStorage"

