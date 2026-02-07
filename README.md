# Meet Transcription Reminder (Gemini)

A Google Chrome extension that helps you remember to enable Gemini transcription in Google Meet calls. It can either remind you with a subtle notification or automatically enable transcription when you join a meeting.

## Features

-   **Active Meeting Detection**: Intelligently detects when you are in an active meeting (ignoring the waiting room).
-   **Smart Reminder**: Displays a non-intrusive balloon notification near the "pen_spark" (Gemini) icon prompting you to enable transcription.
-   **Auto-Start Mode**: A "Set and Forget" mode that automatically clicks the necessary buttons to start transcription as soon as you join a meeting.
-   **Internationalization (i18n)**: Fully localized interface (English, Portuguese, Spanish, French, German, Japanese).
-   **Non-Intrusive UI**: Uses Shadow DOM to ensure the reminder UI doesn't conflict with Google Meet's styles.

## Installation

1.  Clone this repository or download the source code.
2.  Open Chrome and navigate to `chrome://extensions/`.
3.  Enable **Developer mode** in the top right corner.
4.  Click **Load unpacked**.
5.  Select the directory containing the extension files.

## Usage

### Default Mode (Reminder)
When you join a Google Meet call:
1.  The extension detects the meeting and the Gemini transcription trigger icon.
2.  A blue balloon notification will appear pointing to the Gemini icon.
3.  Click **Yes** (or your language equivalent) to start transcription immediately, or **No** to dismiss.

### Auto-Start Mode
1.  Click the extension icon in the Chrome toolbar to open the popup.
2.  Toggle **Auto-Start Transcription** to ON.
3.  The status will change to "Automatic Mode".
4.  Next time you join a meeting, the extension will automatically simulate the user interactions required to start transcription without any input from you.

## Permissions

-   `storage`: Used to save your preference for "Auto-Start" mode.
-   `activeTab` / `scripting`: Required to inject the content script into Google Meet tabs to detect the meeting state and interact with the UI.
-   `https://meet.google.com/*`: The extension only runs on Google Meet pages.

## Privacy

This extension runs entirely locally on your device. No data is collected, stored, or transmitted to any external servers. It interacts only with the DOM of the Google Meet page to perform its function.

## Contributing

Feel free to open issues or submit pull requests if you have suggestions for improvements or bug fixes.
