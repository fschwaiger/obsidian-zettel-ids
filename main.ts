import {
	Editor,
	MarkdownView,
	Notice,
	Plugin,
} from "obsidian";

// Remember to rename these classes and interfaces!

export default class MyPlugin extends Plugin {
	async onload() {
		let generateCallback = (zettelIdMethod: Function) => {
			return (editor: Editor, view: MarkdownView) => {
				let folder = view.file?.parent?.path ?? "";
				let filename = view.file?.name;

				if (!filename) {
					new Notice("Please save the file first.");
					return;
				}

				let zettelId = this.getZettelIdFromFilename(filename);

				if (!zettelId) {
					new Notice("Please name the file with a zettel ID prefix.");
					return;
				}

				let nextZettelId = zettelIdMethod(zettelId);
				let nextZettelFilename = nextZettelId + ".md";
				let data = editor.getSelection();

				// create a new file with a name prefixed with this id
				this.app.vault
					.create(folder + "/" + nextZettelFilename, "")
					.then((file) => {
						// add a link to the new file
						editor.replaceSelection("[[" + nextZettelId + "]]");
						// open the new file
						this.app.workspace.openLinkText(
							nextZettelFilename,
							data,
							true
						);
					})
					.catch((error) => {
						new Notice("Error creating file: " + error);
					});
			};
		};

		// add a command to create a child zettel note
		this.addCommand({
			id: "create-child-zettel",
			name: "Create Child Zettel",
			editorCallback: generateCallback(
				this.getNextChildZettelId.bind(this)
			),
		});

		// add a command to create a sibling zettel note
		this.addCommand({
			id: "create-sibling-zettel",
			name: "Create Sibling Zettel",
			editorCallback: generateCallback(
				this.getNextSiblingZettelId.bind(this)
			),
		});

		// add a command to create the next viable zettel note
		this.addCommand({
			id: "create-next-zettel",
			name: "Create Next Zettel",
			editorCallback: generateCallback(this.getNextZettelId.bind(this)),
		});

		// add a command to open the parent note
		this.addCommand({
			id: "open-parent-zettel",
			name: "Open Parent Zettel",
			editorCallback: (editor: Editor, view: MarkdownView) => {
				if (!view.file?.name) {
					new Notice("Please save the file first.");
					return;
				}

				let zettelId = this.getZettelIdFromFilename(view.file?.name);

				if (!zettelId) {
					new Notice("Please name the file with a zettel ID prefix.");
					return;
				}

				let parentZettelId = this.getParentZettelId(zettelId);

				if (!parentZettelId) {
					new Notice("Parent zettel not found.");
					return;
				}

				let parentFile = this.app.vault
					.getMarkdownFiles()
					.find((file) => {
						return file.name.startsWith(parentZettelId + " ");
					});

				if (!parentFile) {
					new Notice("Parent file not found.");
					return;
				}

				this.app.workspace.openLinkText(parentFile.name, "", true);
			},
		});
	}

	onunload() {}

	getZettelIdFromFilename(filename: string): string {
		if (filename.match(/^[0-9a-zA-Z]+.md$/)) {
			return filename.split(".")[0];
		}

		return filename.split(/\W+/)[0];
	}

	getNextChildZettelId(parentZettelId: string): string {
		// find all existing child files
		let nextChildIndex = this.app.vault
			.getMarkdownFiles()
			.map((file) => {
				return file.name.startsWith(parentZettelId) &&
					!file.name.startsWith(parentZettelId + " ")
					? this.getZettelIdFromFilename(file.name)
					: undefined;
			})
			.filter((zettelId) => {
				return zettelId !== undefined;
			})
			.map((zettelId: string) => {
				// get the last character or number of the zettel id
				let charsOrDigits = zettelId.replace(RegExp('^' + parentZettelId), '');
				// if chars is a number, return the number, otherwise return the char index
				if (charsOrDigits.match(/^[0-9]+$/)) {
					return parseInt(charsOrDigits);
				} else {
					// each letter is a number, a == 1, aa == 27, A == 1, AA == 27
					return charsOrDigits.toLowerCase().split("").reduce((acc, char) => {
						return acc * 26 + char.charCodeAt(0) - 96;
					}, 0);
				}
			}).reduce((acc, index) => {
				return Math.max(acc, index);
			}, 0) + 1;

		return this.getChildZettelId(parentZettelId, nextChildIndex);
	}

	getChildZettelId(parentZettelId: string, childIndex: number): string {
		if (parentZettelId.match(/[a-zA-Z]+$/)) {
			// if the parent ID ends with a letter, append a number
			return parentZettelId + childIndex;
		} else if (parentZettelId == parentZettelId.toUpperCase()) {
			// if the parent ID is all caps, append a number, A == 1
			return parentZettelId + String.fromCharCode(64 + childIndex);
		} else {
			// append a letter, a == 1
			return parentZettelId + String.fromCharCode(96 + childIndex);
		}
	}

	getNextSiblingZettelId(siblingZettelId: string): string {
		return this.getNextChildZettelId(
			this.getParentZettelId(siblingZettelId)
		);
	}

	getParentZettelId(childZettelId: string): string {
		if (childZettelId.match(/[a-zA-Z]+$/)) {
			// if the child zettel id ends with a letter, remove the letter
			return childZettelId.replace(/[a-zA-Z]+$/, "");
		} else {
			// if the child zettel id ends with digits, remove the digits
			return childZettelId.replace(/[0-9]+$/, "");
		}
	}

	getNextZettelId(prevZettelId: string): string {
		let nextZettelId = this.getNextSiblingZettelId(prevZettelId);
		// if the next ID does not end in 1 or A, use a child id instead
		if (
			!nextZettelId.match(/[aA]$/) &&
			!nextZettelId.match(/(?<=[a-zA-Z])1$/)
		) {
			nextZettelId = this.getNextChildZettelId(prevZettelId);
		}
		return nextZettelId;
	}
}
