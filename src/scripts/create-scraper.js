#!/usr/bin/env node
import { Command } from "commander";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const program = new Command();
program
  .name("create-scraper")
  .description("Create a new scraper from template")
  .argument("<name>", "Name of the new scraper")
  .option("-d, --description <description>", "Description of the scraper")
  .action(async (name, options) => {
    try {
      const templateDir = path.join(__dirname, "../templates/scraper-template");
      const targetDir = path.join(__dirname, `../api/${name}`);

      // Create target directory
      await fs.mkdir(targetDir, { recursive: true });

      // Copy and modify module.js
      let moduleContent = await fs.readFile(
        path.join(templateDir, "module.js"),
        "utf8",
      );
      moduleContent = moduleContent.replace(/scrape/g, name);
      await fs.writeFile(
        path.join(targetDir, `${name}-module.js`),
        moduleContent,
      );

      // Copy and modify router.js
      let routerContent = await fs.readFile(
        path.join(templateDir, "router.js"),
        "utf8",
      );
      routerContent = routerContent
        .replace(/scrape/g, name)
        .replace("./module.js", `./${name}-module.js`);
      await fs.writeFile(
        path.join(targetDir, `${name}-router.js`),
        routerContent,
      );

      // Copy and modify cli.js
      let cliContent = await fs.readFile(
        path.join(templateDir, "cli.js"),
        "utf8",
      );
      cliContent = cliContent
        .replace(/scrape/g, name)
        .replace("./module.js", `../api/${name}/${name}-module.js`);
      await fs.writeFile(path.join(__dirname, `${name}.js`), cliContent);

      // Make CLI script executable
      await fs.chmod(path.join(__dirname, `${name}.js`), 0o755);

      console.log(`Created new scraper '${name}' successfully!`);
      console.log(`- CLI script: src/scripts/${name}.js`);
      console.log(`- API module: src/api/${name}/${name}-module.js`);
      console.log(`- API router: src/api/${name}/${name}-router.js`);
    } catch (error) {
      console.error(`Error creating scraper: ${error.message}`);
      process.exit(1);
    }
  });

program.parse(process.argv);
