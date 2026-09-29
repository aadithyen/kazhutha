{
  description = "Kazhutha dev environment";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
  inputs.flake-utils.url = "github:numtide/flake-utils";

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let pkgs = nixpkgs.legacyPackages.${system};
      in {
        devShells.default = pkgs.mkShell {
          packages = with pkgs; [
            nodejs_22
            pnpm
            typescript
          ];
          shellHook = ''
            echo "kazhutha dev shell: node $(node -v), pnpm $(pnpm -v)"
            echo "run: pnpm install; pnpm dev:signaling; pnpm dev:web"
          '';
        };
      });
}
