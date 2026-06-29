# Private Couple Chat 💖

A premium, private, and secure real-time chat web application designed exclusively for **only two users** (you and your partner). Built with vanilla HTML5, CSS3 glassmorphic romantic design, vanilla ES6 JavaScript modules, and powered by Firebase (Authentication, Firestore, and Hosting).

---

## Features 🌟

- **WhatsApp-like Real-time Messaging:** Smooth chat bubble layout, double-checkmark read receipts, and auto-scroll to the newest messages.
- **Typing Indicator:** Real-time feedback showing when your partner is drafting a message.
- **Active Presence Status:** Displays online/offline status, with a formatted last-seen stamp (e.g., "last seen today at 10:42 AM").
- **Dark & Light Themes:** Instant toggle with persistence in browser local storage.
- **Sound Alerts:** Audio feedback on new incoming messages with Web Audio API synthesizer chimes as an autoplay safety fallback.
- **Built-in Emoji Drawer:** Categorized popup menu to quickly drop heart, smiley, food, or activity emojis directly into messages.
- **Glassmorphism Theme:** Vibrant pink and purple fluid gradients, frosted glass cards, and smooth hover feedback.
- **Security-First Rules:** Strict Firestore Security Rules preventing any unauthorized reads or writes.

---

## Folder Structure 📂

```text
private-chat/
│
├── index.html              # Entry gatekeeper that guards routes using Auth state
├── login.html              # Romantic glassmorphic Login screen
├── chat.html               # Main WhatsApp-like couple workspace screen
│
├── css/
│   ├── style.css           # Global resets, variable design tokens, & Login styling
│   └── chat.css            # Bubble layout, header, sidebars, drawer, & animations
│
├── js/
│   ├── firebase.js         # Initializer loading Firebase v10 SDK via CDN ESM
│   ├── auth.js             # Route observer guards & logout handler
│   ├── login.js            # Login validation, persistence, & email mapper
│   └── chat.js             # Real-time state listeners, messaging, presence, & sound
│
├── assets/
│   ├── logo.png            # AI-generated romantic couple vector logo
│   ├── wallpaper.jpg       # Elegant pink/purple background texture
│   └── sounds/
│       └── notification.wav # Local synthesised chime audio file
│
├── firestore.rules         # Security Rules protecting database paths
└── README.md               # Setup and configuration documentation
```

---

## Firebase Setup Guide ⚙️

Follow these step-by-step instructions to configure the backend:

### Step 1: Create a Firebase Project
1. Open the [Firebase Console](https://console.firebase.google.com/).
2. Click **Add Project** and give it a name (e.g., `private-couple-chat`).
3. (Optional) Disable Google Analytics for simplicity, then click **Create Project**.

### Step 2: Enable Email/Password Authentication
1. In the left-hand navigation menu under Build, click **Authentication**.
2. Click **Get Started**.
3. Under the **Sign-in method** tab, click **Email/Password**.
4. Enable the first toggle (**Email/Password**) and click **Save**.

### Step 3: Register the Two Authorized Accounts
Since the system is restricted to only two users, create them manually:
1. In the **Authentication** section, go to the **Users** tab.
2. Click **Add user**.
3. Create the account for User 1:
   - **Email:** `vaishnav@privatechat.local`
   - **Password:** *[Create a strong password]*
4. Click **Add user**.
5. Click **Add user** again to create the account for User 2:
   - **Email:** `chikku@privatechat.local`
   - **Password:** *[Create a strong password]*
6. Click **Add user**.

*Note: The application's JS login file automatically maps the username inputs `vaishnav` and `chikku` to these private local emails, allowing you to login with just your username and password.*

### Step 4: Create Cloud Firestore Database
1. Under Build, click **Firestore Database**.
2. Click **Create Database**.
3. Choose your database location and click **Next**.
4. Select **Start in test mode** (we will deploy strict rules later), and click **Create**.

### Step 5: Configure Web App Settings
1. Go back to the **Project Overview** (gear icon next to Project Overview -> **Project Settings**).
2. Under the **General** tab, scroll down to the "Your apps" section and click the **Web icon (`</>`)**.
3. Enter an App Nickname (e.g., `Couple Chat Web`) and click **Register app**.
4. Copy the config object. It will look like this:
   ```javascript
   const firebaseConfig = {
     apiKey: "AIzaSy...",
     authDomain: "...",
     projectId: "...",
     storageBucket: "...",
     messagingSenderId: "...",
     appId: "..."
   };
   ```
5. Open [private-chat/js/firebase.js](file:///c:/Users/91996/OneDrive/download/project%20love/private-chat/js/firebase.js) in your text editor.
6. Replace the placeholder values in the `firebaseConfig` object with your copied configurations and save the file.

### Step 6: Apply Database Security Rules
1. In the Firebase Console, go to **Firestore Database** -> **Rules** tab.
2. Replace the existing rules code with the content of [private-chat/firestore.rules](file:///c:/Users/91996/OneDrive/download/project%20love/private-chat/firestore.rules).
3. Click **Publish**.

---

## Running Locally 💻

To test the application locally, you must run it through a local web server (since ES modules require `http://` or `https://` protocol to load from CDNs).

Using standard CLI toolings (run from the `private-chat` directory):

**Option A: Using Node.js `http-server` (Recommended)**
```bash
# Install globally
npm install -g http-server

# Run the server
http-server .
```

**Option B: Using Python**
```bash
# Python 3
python -m http.server 8000
```

Open the resulting port URL (e.g. `http://localhost:8080`) in your web browser.

---

## Deployment to Firebase Hosting 🚀

Deploy the application to the web for free using Firebase Hosting:

1. Install the Firebase Command Line Interface globally:
   ```bash
   npm install -g firebase-tools
   ```
2. Log into your Google Account associated with Firebase:
   ```bash
   firebase login
   ```
3. Initialize hosting in the project directory:
   ```bash
   firebase init
   ```
   - Use spacebar to select **Hosting: Configure files for Firebase Hosting...** and optionally **Firestore: Configure Security Rules...**. Press Enter.
   - Select **Use an existing project** and choose your project.
   - For **What do you want to use as your public directory?**, type: `private-chat` (or `.` if you are running it inside the `private-chat` folder).
   - For **Configure as a single-page app (rewrite all urls to /index.html)?**, type: `N`.
   - For **Set up automatic builds and deploys with GitHub?**, type: `N`.
   - If prompted to overwrite existing files, type: `N`.
4. Deploy the project:
   ```bash
   firebase deploy
   ```

Firebase will output your unique production URL (e.g. `https://your-project-id.web.app`) to share with your partner!

---

## Troubleshooting 🔍

- **Uncaught TypeError / ESM Imports fail:** Ensure you are running the project through a web server (e.g. `http-server`) rather than double-clicking the `index.html` file on your filesystem.
- **Audio Notification doesn't play:** Browsers prevent sounds from playing unless the user has interacted with the page first (clicking or typing). Once a click happens, audio will trigger. Additionally, if the local sound file fails, the app uses a built-in Web Audio API synthesizer.
- **Permission Denied in Firestore:** Ensure your Firestore security rules are published correctly and matches the emails you created in Authentication.
- **Customizing the Anniversary Date:** You can customize the date calculated in the sidebar by opening [private-chat/js/chat.js](file:///c:/Users/91996/OneDrive/download/project%20love/private-chat/js/chat.js) and editing the `ANNIVERSARY_DATE` constant at the top of the file.
