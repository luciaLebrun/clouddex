import purgecss from "@fullhuman/postcss-purgecss";

// Only strip unused CSS in production builds; dev keeps every rule so
// hot-reloaded markup never loses styles it hasn't been scanned for yet.
export default {
  plugins:
    process.env.NODE_ENV === "production"
      ? [
          purgecss({
            content: ["./index.html", "./src/**/*.{ts,tsx}"],
          }),
        ]
      : [],
};
