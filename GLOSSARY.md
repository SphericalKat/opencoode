# OpenCoode

Language for conversations with coding agents in OpenCoode.

## Language

**Server**: A saved connection to an OpenCode or Pi backend. Each saved connection is a separate server choice, even when several connections point to the same physical machine. _Avoid_: Machine (when referring to a saved connection)

**Tool-result image**: An image returned by a tool during an agent's work, such as a captured screenshot. It is distinct from an image attached by the user to a prompt. _Avoid_: COT image

### Session sheet

**Session sheet**: The sheet that opens from More… → Session details on the chat screen. It shows the session and lists what the user can do with it. _Avoid_: Actions sheet, details sheet, session menu

**Sheet title bar**: The top bar of a sheet, with the fixed sheet title and the close button.

**Session title**: The name of a session. The Session sheet shows it in large text below the sheet title bar. _Avoid_: Session name (in written text)

**Group**: A labeled cluster of rows in the Session sheet, such as Tools, Configure, or Details. _Avoid_: Section

**Collapsible group**: A group whose content stays hidden until the user taps its heading, such as Manage session or Raw session details. _Avoid_: Disclosure, accordion

**Row**: One tappable line in a group. Most rows open a destination sheet. Some rows run an action directly, such as Export session. _Avoid_: Link, item

**Destination sheet**: The sheet that replaces the Session sheet after the user taps a row, such as the Model sheet. _Avoid_: Subsheet, panel
