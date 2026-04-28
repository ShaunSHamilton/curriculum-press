# Improvements

## Problems

- collapsing sidebar causes UI overflow
- sidebar cannot be expanded, once collapsed
- new routes created with tanstack router are not navigatable, because the routes are not falling back in the server to the dist
- navigating to `/` redirects to `/projects/mine`
- `/projects/mine` is a horrible route name, it should be `/projects/<user_id>`
- fetch requests by client should be made to `/api/*` so that the client page navigation is not conflicted with server routes
