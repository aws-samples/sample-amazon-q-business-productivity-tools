Target directory: /Users/carthick/dev/gitlab/samples/qbusiness-tools-shadow/infra
Axiom language failed to run with error: Linguist not installed
Axiom license failed to run with error: Licensee not installed
Lint:
✔  binary-exec-lib: Did not find a file matching the specified patterns
	✔ **/*.jar
	✔ **/*.exe
	✔ **/*.dll
	✔ **/*.class
	✔ **/*.so
	✔ **/*.o
	✔ **/*.a
✔  binary-archive: Did not find a file matching the specified patterns
	✔ **/*.zip
	✔ **/*.tar
	✔ **/*.tar.gz
	✔ **/*.7z
	✔ **/*.iso
	✔ **/*.rpm
	✔ **/*.tgz
✔  binary-document: Did not find a file matching the specified patterns
	✔ **/*.pdf
	✔ **/*.doc
	✔ **/*.docx
	✔ **/*.xls
	✔ **/*.xlsx
	✔ **/*.ppt
	✔ **/*.pptx
	✔ **/*.odt
✔  amazon-logo: No file matching hash found
✔  third-party-image: Did not find a file matching the specified patterns
	✔ **/*.jpg
	✔ **/*.jpeg
	✔ **/*.png
	✔ **/*.gif
	✔ **/*.tiff
	✔ **/*.ico
	✔ **/*.svg
✔  dataset: Did not find a file matching the specified patterns
	✔ **/*.csv
	✔ **/*.tsv
✔  dockerfile: Did not find a file matching the specified patterns (**/*docker*)
✔  dockerfile-download-statement: Did not find content matching specified patterns
✔  internal-url: Did not find content matching specified patterns
⚠  prohibited-license:
	ℹ PolicyUrl: https://w.amazon.com/bin/view/Open_Source/Tools/Repolinter/Ruleset/Prohibited-License/ Contains 'GPL-3' on line 1595, context: 
	|      "license": "(MIT OR GPL-3.0-or-later)", (package-lock.json)
✔  third-party-license-file: Did not find a file matching the specified patterns
	✔ **/LICENSE*
	✔ **/COPYING*
	✔ **/COPYRIGHT*
	✔ **/GPL*
	✔ **/THANK*
	✔ **/PATENT*
⚠  hidden-or-generated-file: Found files
	ℹ PolicyUrl: https://w.amazon.com/bin/view/Open_Source/Tools/Repolinter/Ruleset/Hidden-Generated-File (.DS_Store)
✔  large-file: No file larger than 500000 bytes found.
