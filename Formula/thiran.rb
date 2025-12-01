class Thiran < Formula
  desc "AI-powered terminal coding assistant with multi-provider LLM support"
  homepage "https://github.com/d1nsh/thiran"
  url "https://registry.npmjs.org/thiran/-/thiran-0.1.0.tgz"
  sha256 "" # TODO: Update after publishing to npm
  license "MIT"

  depends_on "node"

  def install
    system "npm", "install", *std_npm_args
    bin.install_symlink Dir["#{libexec}/bin/*"]
  end

  test do
    # Test that the binary exists and can show help
    system "#{bin}/thiran", "--help"
  end
end
