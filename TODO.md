# TODO List


### Main

- Fix angular-widgetbox so that the user can drop the widget anywhere along the entire vertical of the column. Right now it needs to be dropped somewhere at the top. This fix might not be part of angular-widgetbox, but we need to make a way to make all columns maximum height.

- Add a global listener to ESC keypress that will close the following stuff in order: Any open RSS previews, The login panel. Accmplish this by keeping a stack of open windows and a global keypress dispatcher.

- Make the login panel more intuitive. Think about a different text between the controls.

- When adding a new widget scroll to the widget box.

- Animation css for firefox and MSIE

### RSS

- Resolve relative links in rss feed detection. Try adding "nautil.us" as an rss feed to reporoduce the error.

- Make NEW rss items (by last updated) to bubble up to the top of the list, even when using multiple feeds.

- Remove duplicate items from RSS feeds.

- In Firefox sources can't be added.

- Style the "no RSS items" message.