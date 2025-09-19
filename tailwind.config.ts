import type { Config } from "tailwindcss"
import containerQueries from "@tailwindcss/container-queries"

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx}", // skann alle source-filer
  ],
  theme: {
    extend: {}, // legg til utvidelser hvis du vil
  },
  plugins: [
    containerQueries, // gjør at @container-variantene virker
  ],
}
export default config
