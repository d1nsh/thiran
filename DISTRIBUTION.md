# Distributing Thiran

Guide for distributing Thiran as a binary for users to download and use.

## Option 1: npm Package (Recommended)

The easiest and most common way to distribute Node.js CLI tools.

### Steps to Publish

1. **Ensure package.json is ready:**
   - Version number is set
   - Name, description, keywords are accurate
   - `bin` field points to executable
   - All dependencies are listed

2. **Create npm account:**
   ```bash
   npm adduser
   # Or login if you have an account
   npm login
   ```

3. **Publish to npm:**
   ```bash
   # Build the project
   npm run build

   # Publish (public package)
   npm publish --access public
   ```

4. **Users install with:**
   ```bash
   # Global installation
   npm install -g thiran

   # Then use it
   thiran "your prompt here"
   ```

### Version Updates

```bash
# Bump version and publish
npm version patch  # 0.1.0 -> 0.1.1
npm version minor  # 0.1.0 -> 0.2.0
npm version major  # 0.1.0 -> 1.0.0

npm publish
```

---

## Option 2: Standalone Binaries with pkg

Create platform-specific executables (no Node.js required).

### Setup

```bash
# Install pkg
npm install -g pkg
```

### Create package.json scripts:

```json
{
  "scripts": {
    "build": "tsc",
    "package": "pkg . --targets node18-linux-x64,node18-macos-x64,node18-win-x64 --output dist/binaries/thiran"
  },
  "bin": "./dist/cli/index.js",
  "pkg": {
    "assets": [
      "dist/**/*"
    ],
    "outputPath": "dist/binaries"
  }
}
```

### Build binaries:

```bash
# Build TypeScript first
npm run build

# Create binaries for all platforms
pkg . --targets node18-linux-x64,node18-macos-x64,node18-win-x64 --output dist/binaries/thiran

# This creates:
# - dist/binaries/thiran-linux
# - dist/binaries/thiran-macos
# - dist/binaries/thiran-win.exe
```

### Users download and use:

```bash
# Linux/macOS
chmod +x thiran-linux
./thiran-linux "your prompt"

# Windows
thiran-win.exe "your prompt"
```

---

## Option 3: GitHub Releases with Binaries

Combine pkg with GitHub Releases for easy distribution.

### 1. Create binaries (see Option 2)

### 2. Create GitHub Release:

```bash
# Tag a release
git tag -a v0.1.0 -m "Release v0.1.0"
git push origin v0.1.0

# Use GitHub CLI to create release
gh release create v0.1.0 \
  dist/binaries/thiran-linux \
  dist/binaries/thiran-macos \
  dist/binaries/thiran-win.exe \
  --title "Thiran v0.1.0" \
  --notes "Release notes here"
```

### 3. Users download from:
`https://github.com/d1nsh/thiran/releases`

---

## Option 4: Docker Image

Package as a Docker container.

### Create Dockerfile:

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY dist ./dist

ENTRYPOINT ["node", "dist/cli/index.js"]
```

### Build and publish:

```bash
# Build
docker build -t thiran:latest .

# Tag for Docker Hub
docker tag thiran:latest yourusername/thiran:latest

# Push to Docker Hub
docker push yourusername/thiran:latest
```

### Users run with:

```bash
docker pull yourusername/thiran:latest
docker run -it --rm yourusername/thiran:latest "your prompt"
```

---

## Option 5: Homebrew (macOS)

Create a Homebrew formula for macOS users.

### 1. Create a Homebrew tap repository:
`https://github.com/d1nsh/homebrew-thiran`

### 2. Create Formula:

```ruby
# thiran.rb
class Thiran < Formula
  desc "AI-powered terminal coding assistant"
  homepage "https://github.com/d1nsh/thiran"
  url "https://github.com/d1nsh/thiran/archive/v0.1.0.tar.gz"
  sha256 "..."

  depends_on "node"

  def install
    system "npm", "install", *Language::Node.std_npm_install_args(libexec)
    bin.install_symlink Dir["#{libexec}/bin/*"]
  end

  test do
    system "#{bin}/thiran", "--version"
  end
end
```

### 3. Users install with:

```bash
brew tap d1nsh/thiran
brew install thiran
```

---

## Comparison

| Method | Pros | Cons | Best For |
|--------|------|------|----------|
| **npm** | Easy, standard, auto-updates | Requires Node.js | Developers |
| **pkg binaries** | No Node.js needed, standalone | Large file size (~50MB) | End users |
| **GitHub Releases** | Easy downloads, version control | Manual updates | All users |
| **Docker** | Isolated, reproducible | Requires Docker | Server deployments |
| **Homebrew** | macOS integration | macOS only | Mac users |

---

## Recommended Approach

**For maximum reach:**

1. **Publish to npm** - For developers who have Node.js
2. **Create binaries with pkg** - For users without Node.js
3. **GitHub Releases** - Host binaries for easy download
4. **Add installation instructions to README**

### Example Installation Section:

```markdown
## Installation

### Via npm (Recommended)
\`\`\`bash
npm install -g thiran
\`\`\`

### Download Binary
Download the latest binary for your platform from [Releases](https://github.com/d1nsh/thiran/releases):
- Linux: `thiran-linux`
- macOS: `thiran-macos`
- Windows: `thiran-win.exe`

### From Source
\`\`\`bash
git clone https://github.com/d1nsh/thiran.git
cd thiran
npm install
npm run build
npm link
\`\`\`
```

---

## Continuous Deployment

Automate binary creation with GitHub Actions:

```yaml
# .github/workflows/release.yml
name: Release

on:
  push:
    tags:
      - 'v*'

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18

      - run: npm ci
      - run: npm run build
      - run: npm install -g pkg
      - run: pkg . --targets node18-linux-x64,node18-macos-x64,node18-win-x64

      - uses: softprops/action-gh-release@v1
        with:
          files: |
            dist/binaries/*
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

This automatically creates binaries and releases when you push a git tag!
