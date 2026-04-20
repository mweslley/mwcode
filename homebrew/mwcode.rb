# MWCode Homebrew Formula
#
# Para publicar:
#   1. Crie um repo "homebrew-tap" no seu GitHub: https://github.com/mweslley/homebrew-tap
#   2. Coloque este arquivo em Formula/mwcode.rb dentro desse repo
#   3. Usuários instalam com:
#      brew tap mweslley/tap
#      brew install mwcode
#
# Atualizar:
#   - Gere novo release (tag) no repo mwcode
#   - Atualize a url e sha256 abaixo
#   - Commit no homebrew-tap

class Mwcode < Formula
  desc "Sistema flexível de agentes de IA — modo Pessoal ou Empresa. 100% pt-BR."
  homepage "https://github.com/mweslley/mwcode"
  url "https://github.com/mweslley/mwcode/archive/refs/tags/v0.1.0.tar.gz"
  sha256 "COLOQUE_O_SHA256_AQUI"  # gere com: shasum -a 256 v0.1.0.tar.gz
  license "MIT"
  head "https://github.com/mweslley/mwcode.git", branch: "main"

  depends_on "node@20"
  depends_on "pnpm"
  depends_on "git"

  def install
    system "pnpm", "install", "--frozen-lockfile"
    libexec.install Dir["*"]
    (bin/"mwcode").write <<~EOS
      #!/bin/bash
      exec node "#{libexec}/bin/mwcode.js" "$@"
    EOS
    chmod 0755, bin/"mwcode"
  end

  def caveats
    <<~EOS
      Para começar:
        1. Configure sua chave de API:
           nano #{libexec}/.env

        2. Inicie o MWCode:
           mwcode

        3. Acesse:
           http://localhost:5173
    EOS
  end

  test do
    assert_match "MWCode", shell_output("#{bin}/mwcode version")
  end
end
