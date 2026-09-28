# Minimal free (material-kit-react) — attribution

Portions of `src/ui/minimal/**` are ported from the **Minimal free** template:

- Source: https://github.com/minimal-ui-kit/material-kit-react
- Commit: `69e780a40c455d664b2e13c525faf1d492a072a7` (2025-04-03)
- License: MIT

The original code is written for Vite + React Router. It has been ported to
Next.js App Router for TipPaw: React Router (`Link`, `useNavigate`,
`useLocation`) was replaced with `next/link` / `next/navigation`, the theme
palette and typography were changed to the TipPaw design (spec §11), unused
pages/components (products, blog, users, auth, notifications, language,
search, workspaces) were removed, and the icon system was simplified to use
`@iconify/react` directly instead of an offline-bundled icon set.

## MIT License

Copyright (c) 2021 Minimal UI (https://minimals.cc/)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
