# RealMultiLLM - Your Personal LLM Powerhouse

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

An open-source, locally-hosted Next.js application designed to be your ultimate companion for interacting with, comparing, and managing Large Language Models (LLMs).

This tool provides a unified interface for multiple LLM providers, allowing you to leverage the best models for any task without switching contexts. It's built for developers, researchers, and AI enthusiasts who want a powerful, private, and customizable AI sandbox.

## 🚀 Key Features

*   **Multi-Provider Support:** Seamlessly switch between major LLM providers:
    *   OpenAI (GPT models)
    *   Anthropic (Claude models)
    *   Google AI (Gemini models)
*   **Model Comparison:** Run prompts against multiple models simultaneously to compare their responses, speed, and quality.
*   **Conversation Management:** All your conversations are saved locally, giving you full control and privacy over your data.
*   **Persona Management:** Create and save custom personas to tailor the AI's behavior for different tasks.
*   **Analytics Dashboard:** Visualize your usage statistics and compare model performance over time.
*   **Secure & Private:** Your API keys and conversations are stored securely in your local environment.
*   **Light & Dark Mode:** Because we care about your eyes.

## 🛠️ Tech Stack

*   **Framework:** [Next.js](https://nextjs.org/)
*   **Language:** [TypeScript](https://www.typescriptlang.org/)
*   **Authentication:** [NextAuth.js](https://next-auth.js.org/)
*   **Database:** [Prisma](https://www.prisma.io/) with SQLite
*   **Styling:** [Tailwind CSS](https://tailwindcss.com/)
*   **UI Components:** [Shadcn UI](https://ui.shadcn.com/)
*   **State Management:** React Hooks & Context API
*   **Testing:** [Vitest](https://vitest.dev/)

## 🏁 Getting Started

Follow these steps to get the application running on your local machine.

### Prerequisites

*   [Node.js](https://nodejs.org/en/) (v20 or later)
*   [npm](https://www.npmjs.com/)

### 1. Clone the Repository

```bash
git clone https://github.com/IAlready8/RealMultiLLM.git
cd RealMultiLLM
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Environment Variables

Create a `.env.local` file by copying the example file:

```bash
cp .env.example .env.local
```

Now, open `.env.local` and add your API keys and secrets.

```dotenv
# Generate a secret with: openssl rand -base64 32
NEXTAUTH_SECRET=

# OAuth (Optional - for user login)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=

# LLM API Keys (at least one is required)
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GOOGLE_AI_API_KEY=
```

### 4. Set Up the Database

This project uses Prisma with a local SQLite database.

```bash
npx prisma generate
npx prisma db push
```

### 5. Run the Development Server

```bash
npm run dev
```

The application should now be running at [http://localhost:3000](http://localhost:3000).

## ⚙️ Usage

*   **Multi-Chat:** The main interface for interacting with LLMs. Select your desired models from the dropdowns and start chatting.
*   **Comparison:** View side-by-side comparisons of model responses.
*   **Personas:** Create and manage custom instruction sets for the AI.
*   **Analytics:** Track your token usage and model preferences.
*   **Settings:** Manage your API keys and application settings.

## 📂 Project Structure

```
/
├── app/                # Next.js App Router pages and API routes
├── components/         # Reusable React components
├── hooks/              # Custom React hooks
├── lib/                # Core libraries and utilities (auth, prisma, etc.)
├── prisma/             # Database schema and migrations
├── services/           # Business logic and external API services
├── test/               # Vitest tests
└── ...
```

## 🤝 Contributing

Contributions are welcome! If you have a feature request, bug report, or want to contribute code, please open an issue or submit a pull request.

1.  Fork the repository.
2.  Create your feature branch (`git checkout -b feature/AmazingFeature`).
3.  Commit your changes (`git commit -m 'feat: Add some AmazingFeature'`).
4.  Push to the branch (`git push origin feature/AmazingFeature`).
5.  Open a Pull Request.

## 📄 License

This project is licensed under the MIT License.
