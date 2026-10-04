# Future Feed: setup guide

About 15 minutes. You need one Google account and one GitHub account. Students need neither: they only open the link.

How it works: the website lives on GitHub Pages. Every post is saved as a row in a Google Sheet, through a small Google Apps Script that you deploy once. Everyone who opens the link sees the same feed.

---

## Part A. Google Sheet and Apps Script (about 8 minutes)

1. Go to sheets.google.com and create a blank spreadsheet. Name it **Future Feed 2050**.
2. In the menu, click **Extensions > Apps Script**. A code editor opens in a new tab.
   Click **Untitled project** at the top left and rename it **Future Feed**.
3. Delete everything in the editor. Open `apps-script/Code.gs` from this folder, copy all of it, and paste it in.
4. Near the top, change the class code if you want:
   `const CLASS_CODE = 'FUTURES2050';`
   Students type this code to post, which keeps strangers out. Set it to `''` to switch it off.
5. Click the **Save** icon (or Ctrl/Cmd + S).
6. In the function dropdown next to **Run**, choose **setup**, then click **Run**.
   - Google asks for permission. Click **Review permissions**, choose your account.
   - If you see "Google hasn't verified this app", click **Advanced**, then **Go to Future Feed (unsafe)**, then **Allow**. This is normal for your own scripts.
   - Go back to the spreadsheet: a sheet called **Posts** now has a yellow header row.
7. Click **Deploy > New deployment**.
   - Click the gear next to "Select type" and choose **Web app**.
   - Description: `Future Feed`
   - Execute as: **Me**
   - Who has access: **Anyone**
   - Click **Deploy**, then **Authorize access** if asked.
8. Copy the **Web app URL**. It looks like `https://script.google.com/macros/s/AKfy…/exec`. Keep it for Part B.

> If "Anyone" is missing from the access list, your university account blocks public web apps. Use a personal Gmail account for Part A instead.

---

## Part B. GitHub Pages website (about 7 minutes)

1. Sign in at github.com (create a free account if needed).
2. Click **+ > New repository**.
   - Repository name: `future-feed`
   - Choose **Public**
   - Click **Create repository**.
3. On the new repository page, click **uploading an existing file**.
4. Drag in everything from this folder: `index.html`, `app.js`, `style.css`, `config.js`, `README.md` and the whole `assets` folder (you can also include `apps-script` and this guide). Click **Commit changes**.
5. Click `config.js`, then the **pencil** icon to edit it. Paste your Web app URL between the quotes:
   `scriptUrl: "https://script.google.com/macros/s/AKfy…/exec",`
   Click **Commit changes**.
6. Go to **Settings > Pages**. Under "Build and deployment", set Source to **Deploy from a branch**, Branch to **main** and folder **/ (root)**. Click **Save**.
7. Wait 1 to 2 minutes, then refresh the page. Your link appears at the top:
   `https://YOUR-USERNAME.github.io/future-feed/`

---

## Part C. Test it (2 minutes)

1. Open your link. The yellow "Demo mode" bar should be gone.
2. Fill in a test post, type the class code, and click **Post to the feed**.
3. Open the Google Sheet: the post is now a row in **Posts**.
4. Open the link on your phone too: the same post is there.
5. Delete the test row in the Sheet when you are done.

---

## Running the class

- **Share** the link and the class code with students.
- **Hide a post:** tick the box in its `hidden` column. It disappears from the feed at the next refresh. Untick to bring it back.
- **Delete a post:** delete its row in the Sheet.
- **Fix a typo for a student:** edit the cell in the Sheet.
- **Likes** are counted in the `likes` column. Each browser can like a post once.
- The feed refreshes itself every minute, and students can tap ↻ to refresh sooner.
- **Before class**, remind students that the page is public: first names or group names only, and no personal details.

### Images

Students either pick one of five drawn scenes (coastal barangay, island livelihoods, mountain village, city neighbourhood, farmland) or paste their own image link. For a drawing on paper: take a photo, upload it to Google Drive, set sharing to **Anyone with the link**, and paste the link. The site converts Drive links automatically.

### Changing the class code or the script later

After editing `Code.gs`, click **Deploy > Manage deployments**, click the **pencil**, set Version to **New version**, and click **Deploy**. The URL stays the same, so nothing changes on GitHub.

### Changing the header text or default year

Edit `config.js` on GitHub (title, activity, course, defaultYear).

---

## Troubleshooting

| What you see | What to do |
|---|---|
| Yellow "Demo mode" bar still showing | `scriptUrl` in `config.js` is empty or not saved. It must start with `https://script.google.com/` and end with `/exec`. |
| "Could not load the feed" | Check the deployment's access is **Anyone** (not "Anyone with Google account"), then redeploy as a New version. |
| "That class code is not right" | The code in `Code.gs` and what students type differ (capital letters don't matter). |
| You changed `Code.gs` but nothing changed | Deploy a **New version** (see above). |
| A student's image doesn't show | Their Drive file is not shared as "Anyone with the link", or the link is to a web page, not an image. |
| Site link shows 404 | Wait 2 minutes after turning on Pages, and check that `index.html` is in the top level of the repository, not inside a folder. |
