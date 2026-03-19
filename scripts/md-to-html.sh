#!/usr/bin/env bash
set -euo pipefail
# Very lightweight Markdown to HTML converter for headings, paragraphs, code, and lists.
# Usage: scripts/md-to-html.sh input.md > output.html
awk '
  BEGIN { inlist=0; incode=0 }
  /^```/ { if (incode==0) { print "<pre><code>"; incode=1 } else { print "</code></pre>"; incode=0 } next }
  incode==1 { gsub("&","&amp;"); gsub("<","&lt;"); gsub(">","&gt;"); print; next }
  /^# / { print "<h1>" substr($0,3) "</h1>"; next }
  /^## / { print "<h2>" substr($0,4) "</h2>"; next }
  /^### / { print "<h3>" substr($0,5) "</h3>"; next }
  /^- / { if (inlist==0) { print "<ul>"; inlist=1 } print "<li>" substr($0,3) "</li>"; next }
  /^[[:space:]]*$/ { if (inlist==1) { print "</ul>"; inlist=0 } next }
  { if (inlist==1) { print "</ul>"; inlist=0 } print "<p>" $0 "</p>" }
  END { if (inlist==1) print "</ul>" }
' "$@"
