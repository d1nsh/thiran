# Distributing Thiran

Guide for distributing Thiran to end users through multiple channels.

## Supported Distribution Methods

1. **npm** - Global package installation (all platforms)
2. **Homebrew** - Native macOS installation
3. **Binaries** - Standalone executables (planned, see Known Issues)

---

## Option 1: npm Package (Recommended)

The primary distribution method for Node.js CLI tools. Works on all platforms.

### Initial Setup

1. **Create npm account:**
   ```bash
   npm adduser
   # Or login if you have an account
   npm login
   ```

### Publishing

1. **Ensure everything is ready:**
   ```bash
   # Run tests
   npm test

   # Build the project
   npm run build
   ```

2. **Publish to npm:**
   ```bash
   # First publish
   npm publish --access public
   ```

3. **Users install with:**
   ```bash
   npm install -g thiran
   thiran "your prompt here"
   ```

### Version Updates

```bash
# Bump version (automatically commits and tags)
npm version patch  # 0.1.0 -> 0.1.1 (bug fixes)
npm version minor  # 0.1.0 -> 0.2.0 (new features)
npm version major  # 0.1.0 -> 1.0.0 (breaking changes)

# Publish the new version
npm publish

# Push tags to git
git push && git push --tags
```

### Unpublishing (if needed)

```bash
# Unpublish a specific version (within 72 hours)
npm unpublish thiran@0.1.0

# Deprecate instead of unpublishing (preferred)
npm deprecate thiran@0.1.0 "Please upgrade to 0.1.1"
```

---

## Option 2: Homebrew (macOS)

Native package manager experience for macOS users. Requires npm package to be published first.

### Initial Setup

The Homebrew formula is in `Formula/thiran.rb`. Users can install directly from this repository.

### Publishing Process

1. **Publish to npm first** (see Option 1)

2. **Get the tarball SHA256:**
   ```bash
   # Download the npm tarball
   curl -L https://registry.npmjs.org/thiran/-/thiran-0.1.0.tgz -o thiran.tgz

   # Calculate SHA256
   shasum -a 256 thiran.tgz
   ```

3. **Update Formula/thiran.rb:**
   ```ruby
   url "https://registry.npmjs.org/thiran/-/thiran-0.1.0.tgz"
   sha256 "abc123..." # paste the SHA256 from above
   ```

4. **Test locally:**
   ```bash
   brew install --build-from-source Formula/thiran.rb
   thiran --help
   brew uninstall thiran
   ```

5. **Commit and push:**
   ```bash
   git add Formula/thiran.rb
   git commit -m "Update Homebrew formula to v0.1.0"
   git push
   ```

### Users Install With

```bash
# Install from this repository
brew install d1nsh/thiran/thiran

# Or create a separate tap (optional)
brew tap d1nsh/thiran
brew install thiran
```

### Creating a Separate Tap (Optional)

For a cleaner experience, you can create a dedicated `homebrew-thiran` repository:

1. Create new repository: `d1nsh/homebrew-thiran`
2. Move `Formula/thiran.rb` to the new repo
3. Users can then: `brew tap d1nsh/thiran && brew install thiran`

See `HOMEBREW.md` for detailed Homebrew maintenance guide.

---

## Option 3: Standalone Binaries (Planned)

**Status:** Currently blocked by ESM compatibility issues with pkg tooling.

### Known Issues

The `pkg` tool (including `@yao-pkg/pkg` fork) has poor ES Module (ESM) support:
- Thiran uses ESM (`import/export`)
- Dependencies like `ink` and `conf` are ESM-only
- Binaries build but fail at runtime with `ERR_REQUIRE_ESM`

### Solutions Being Evaluated

1. **esbuild bundling**: Bundle to CommonJS before packaging
2. **Alternative tools**: `caxa`, Node.js SEA (Single Executable Applications)
3. **Defer binaries**: Focus on npm + Homebrew distribution

### If/When Binaries Are Fixed

The GitHub Actions workflow in `.github/workflows/release.yml` is set up to:
1. Build binaries for Linux, macOS, and Windows
2. Automatically create GitHub releases when you push a version tag
3. Upload binaries to the release

To trigger a release:
```bash
git tag v0.1.0
git push origin v0.1.0
```

---

## Distribution Checklist

When releasing a new version:

### 1. Pre-Release
- [ ] Update version in `package.json`
- [ ] Run all tests: `npm test`
- [ ] Build successfully: `npm run build`
- [ ] Update CHANGELOG.md (if exists)
- [ ] Commit all changes

### 2. npm Release
- [ ] `npm publish --access public`
- [ ] Verify on npmjs.com: https://www.npmjs.com/package/thiran

### 3. Homebrew Update
- [ ] Download npm tarball and get SHA256
- [ ] Update `Formula/thiran.rb` with new version and SHA256
- [ ] Test formula locally
- [ ] Commit and push formula update

### 4. Git Tagging
- [ ] Tag the release: `git tag v0.1.0`
- [ ] Push tag: `git push origin v0.1.0`
- [ ] Create GitHub release with notes

### 5. Announce
- [ ] Update README if needed
- [ ] Announce on social media / blog
- [ ] Update any documentation sites

---

## Useful Commands

```bash
# Check what will be included in npm package
npm pack --dry-run

# View package info
npm view thiran

# Check who can publish
npm owner ls thiran

# Test installation locally
npm install -g .

# Uninstall local test
npm uninstall -g thiran
```

---

## Resources

- [npm Publishing Guide](https://docs.npmjs.com/cli/v8/commands/npm-publish)
- [Homebrew Formula Cookbook](https://docs.brew.sh/Formula-Cookbook)
- [Creating a Homebrew Tap](https://docs.brew.sh/How-to-Create-and-Maintain-a-Tap)
- [Semantic Versioning](https://semver.org/)
