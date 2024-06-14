import inquirer from 'inquirer';
import fs from 'fs';
import path from 'path';
import prefixes from '../data/prefixes.js';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const categories = Object.keys(prefixes).map(key => ({ name: key, value: key }));
const tempFilePath = path.join(__dirname, 'selectedCategories.json');

export async function promptForCategories() {
  let savedCategories = [];
  if (fs.existsSync(tempFilePath)) {
    savedCategories = JSON.parse(fs.readFileSync(tempFilePath, 'utf8'));
  }

  const questions = [
    {
      type: 'checkbox',
      name: 'selectedCategories',
      message: 'Select categories to use for domain generation:',
      choices: [...categories, new inquirer.Separator(), { name: 'Clear All', value: 'clear_all' }],
      default: savedCategories
    }
  ];

  const answers = await inquirer.prompt(questions);
  if (answers.selectedCategories.includes('clear_all')) {
    fs.writeFileSync(tempFilePath, JSON.stringify(['default']));
    return promptForCategories();
  }

  fs.writeFileSync(tempFilePath, JSON.stringify(answers.selectedCategories), 'utf8');
  return answers.selectedCategories;
}