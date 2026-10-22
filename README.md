# JPTranslate

JPTranslate is a macOS Safari Web Extension that adds **Jisho Search** to the
context menu for selected text. Results appear in a compact panel beside the
selection, so a lookup does not require navigating away from the current page.

## Build and install

This local build requires Xcode 26 and Safari 26 on macOS.

```sh
make install
```

The generated app remains at `build/JPTranslate.app`. On first use, open
Safari Settings and:

1. Under **Developer**, enable **Allow unsigned extensions**.
2. Under **Extensions**, enable **JPTranslate**.

The host app has a button that opens the correct Safari settings pane. Because
the project uses Xcode's local ad-hoc signing, Safari requires **Allow unsigned
extensions** to be enabled again after Safari restarts.

Every `make install` leaves Safari running, removes repository-local stale
copies and registrations, and hot-updates the app at the single canonical
path. This preserves Safari's **Allow unsigned extensions** setting. If Safari
continues using an older extension worker after an update, toggle JPTranslate
off and on once under **Safari Settings > Extensions**; quitting Safari is not
required.

Select text on a normal webpage, Control-click or right-click it, and choose
**Jisho Search**.

## Commands

```sh
make help
make build
make install
make status
make test
make reinstall
make uninstall
make clean
```

`make clean` performs a full uninstall before removing DerivedData. Install,
uninstall, and clean never quit Safari. Both generated directories, `.build/`
and `build/`, are ignored by Git.

## Privacy

JPTranslate uses `activeTab` access only after **Jisho Search** is selected. It
does not request permanent access to browsing history, every website, or
Jisho itself. The background worker sends the selected query to the bundled
native extension, which performs the dictionary request through `URLSession`.

