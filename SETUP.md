# GitHub Pages Setup Guide

Follow these steps to publish the SSBM Resources Hub as a GitHub Pages website.

## Step 1: Initialize Git Repository

Open your terminal in the project directory and run:

```bash
git init
git add .
git commit -m "Initial commit: SSBM Resources Hub"
```

## Step 2: Create GitHub Repository

1. Go to [GitHub](https://github.com) and log in
2. Click the "+" icon in the top right corner
3. Select "New repository"
4. Name it `ssbm-resources` (or your preferred name)
5. Leave it public (required for free GitHub Pages)
6. Do NOT initialize with README, .gitignore, or license (we already have these)
7. Click "Create repository"

## Step 3: Connect Local Repository to GitHub

GitHub will show you commands to run. Use the "push an existing repository" section:

```bash
git remote add origin https://github.com/YOUR-USERNAME/ssbm-resources.git
git branch -M main
git push -u origin main
```

Replace `YOUR-USERNAME` with your actual GitHub username.

## Step 4: Enable GitHub Pages

1. Go to your repository on GitHub
2. Click "Settings" (top menu)
3. Click "Pages" in the left sidebar
4. Under "Source", select "Deploy from a branch"
5. Under "Branch", select `main` and `/ (root)`
6. Click "Save"

## Step 5: Access Your Site

After a few minutes, your site will be live at:

```
https://YOUR-USERNAME.github.io/ssbm-resources/
```

You can find the exact URL in the Pages settings.

The main page (index.html) will show the SSBM Resources Hub with links to:
- The Way of Fox (matchup guides)
- Fox Cookbook
- Doubles Guide
- And all other resources

## Updating Your Site

Whenever you make changes:

```bash
git add .
git commit -m "Description of your changes"
git push
```

GitHub Pages will automatically rebuild and deploy your site within a few minutes.

## Custom Domain (Optional)

If you want to use a custom domain:

1. Add a file named `CNAME` to your repository with your domain name
2. Configure your domain's DNS settings to point to GitHub Pages
3. Follow [GitHub's custom domain guide](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site)

## Troubleshooting

- **Site not loading?** Wait 5-10 minutes after enabling Pages
- **404 errors?** Make sure `index.html` is in the root directory
- **Changes not showing?** Clear your browser cache or wait for GitHub to rebuild (usually 1-2 minutes)

## Notes

- The site is completely static (HTML/CSS/JS only), so it works perfectly with GitHub Pages
- No build process or dependencies required
- All assets (videos, images) are either embedded or linked externally
- The main landing page is `index.html` which shows the full SSBM Resources Hub
