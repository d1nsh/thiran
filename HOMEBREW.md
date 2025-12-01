# Homebrew Distribution Guide

This guide explains how to set up and maintain the Homebrew tap for Thiran.

## What is a Homebrew Tap?

A Homebrew "tap" is a third-party repository that contains formulae for installing software via Homebrew. Thiran's tap allows macOS users to install via `brew install`.

## Repository Structure

```
thiran/
├── Formula/
│   └── thiran.rb          # Homebrew formula
├── HOMEBREW.md            # This file
└── README.md              # Main README (includes Homebrew instructions)
```

## Setting Up the Tap (One-time Setup)

Since the formula is in the main repository, users can install directly:

```bash
# Install from this repository
brew install d1nsh/thiran/thiran
```

## Alternative: Separate Tap Repository (Optional)

For a cleaner setup, you can create a separate `homebrew-thiran` repository:

1. **Create new repository**: `d1nsh/homebrew-thiran`
2. **Copy Formula/**: Move `Formula/thiran.rb` to the new repo
3. **Users install via**:
   ```bash
   brew tap d1nsh/thiran
   brew install thiran
   ```

## Updating the Formula

When you publish a new version to npm:

### 1. Get the SHA256 hash

```bash
# Download the tarball from npm
curl -L https://registry.npmjs.org/thiran/-/thiran-0.1.0.tgz -o thiran.tgz

# Calculate SHA256
shasum -a 256 thiran.tgz
```

### 2. Update Formula/thiran.rb

```ruby
url "https://registry.npmjs.org/thiran/-/thiran-0.1.0.tgz"
sha256 "abc123..." # paste the SHA256 from above
```

### 3. Commit and push

```bash
git add Formula/thiran.rb
git commit -m "Update formula to v0.1.0"
git push
```

### 4. Users update via

```bash
brew update
brew upgrade thiran
```

## Testing the Formula Locally

Before publishing updates:

```bash
# Install from local formula
brew install --build-from-source Formula/thiran.rb

# Test the installation
thiran --help

# Uninstall after testing
brew uninstall thiran
```

## Homebrew Formula Best Practices

1. **Version Updates**: Update both `url` and `sha256` for each release
2. **Testing**: Always test locally before committing
3. **Dependencies**: Keep `depends_on "node"` - required for npm packages
4. **Test Block**: Ensure the test validates the installation works

## Publishing Checklist

Before releasing a new version:

- [ ] Publish to npm: `npm publish`
- [ ] Download tarball and get SHA256 hash
- [ ] Update `Formula/thiran.rb` with new version and hash
- [ ] Test formula locally: `brew install --build-from-source Formula/thiran.rb`
- [ ] Commit and push formula updates
- [ ] Update README if installation instructions changed
- [ ] Announce to users they can `brew upgrade thiran`

## Troubleshooting

### Formula won't install
- Verify the SHA256 hash matches the npm tarball
- Check that Node.js is installed: `brew list node`
- Test the formula syntax: `brew audit Formula/thiran.rb`

### Users can't find the tap
- Ensure the repository is public
- Verify the naming: `d1nsh/thiran` or `d1nsh/homebrew-thiran`
- Check the formula is in `Formula/` directory

## Resources

- [Homebrew Formula Cookbook](https://docs.brew.sh/Formula-Cookbook)
- [Homebrew Node.js Formulae](https://docs.brew.sh/Node-for-Formula-Authors)
- [Creating a Tap](https://docs.brew.sh/How-to-Create-and-Maintain-a-Tap)
