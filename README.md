# World TV — Netflix / YouTube TV-style IPTV web app

A static browser IPTV interface built around iptv-org's public API.


The app does not host video. It plays the stream URLs supplied by the iptv-org data. Playback varies by broadcaster, geography, browser support and stream restrictions.


## Shareable channel links

Each channel now has a stable share URL using its iptv-org channel ID, for example:
`https://tv.checkpnr.in/?channel=CHANNEL_ID`

Use the ↗ button on a channel card to share or copy its link. Opening the link loads that channel directly in the player.
