const express = require("express");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const { parseResume } = require("./parsers/resumeParser");
const { parseJD } = require("./parsers/jdParser");
const { calculateMatchings, warmupMatching } = require("./services/matchingService");

const app = express();
let jobWarmupPromise;

function readJobDescriptions() {
    const jdFolderPath = path.join(__dirname, "data", "jds");
    return fs.readdirSync(jdFolderPath)
        .filter(file => path.extname(file).toLowerCase() === ".txt")
        .map(file => parseJD(path.parse(file).name, path.join(jdFolderPath, file)));
}

app.use(express.static(path.join(__dirname, "public")));

app.post(
    "/match",
    express.raw({ type: "application/pdf", limit: "10mb" }),
    async (req, res) => {
        if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
            return res.status(400).json({ error: "Please choose a PDF resume to upload." });
        }

        if (req.body.subarray(0, 1024).indexOf(Buffer.from("%PDF-")) === -1) {
            return res.status(400).json({ error: "The uploaded file is not a valid PDF." });
        }

        try {
            let resumeData;
            try {
                resumeData = await parseResume(req.body);
            } catch (error) {
                console.error(error);
                return res.status(400).json({
                    error: "Could not read this PDF. Please upload a valid, text-based PDF."
                });
            }

            if (jobWarmupPromise) {
                await jobWarmupPromise;
            }
            const jdDataList = readJobDescriptions();

            const matchingJobs = await calculateMatchings(
                resumeData.resumeText,
                resumeData.resumeSkills,
                jdDataList
            );

            matchingJobs.sort(
                (a, b) => b.matchingScore - a.matchingScore
            );

            const finalOutput = {
                salary: resumeData.salary,
                yearOfExperience: resumeData.yearOfExperience,
                resumeSkills: resumeData.resumeSkills,
                matchingJobs
            };

            res.json(finalOutput);

        } catch (error) {
            console.error(error);
            res.status(500).json({ error: error.message });
        }
    }
);

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.use((error, req, res, next) => {
    if (error.status === 413) {
        return res.status(413).json({ error: "PDF files must be 10 MB or smaller." });
    }

    next(error);
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);

    jobWarmupPromise = Promise.resolve()
        .then(() => warmupMatching(readJobDescriptions()))
        .then(() => console.log("Embedding model and job descriptions are ready."))
        .catch(error => {
            console.error(`Embedding warmup failed; the first analysis will retry: ${error.message}`);
        });

    if (process.argv.includes("--open-browser")) {
        const chromeRoots = [
            process.env.ProgramFiles,
            process.env["ProgramFiles(x86)"],
            process.env.LOCALAPPDATA
        ].filter(Boolean);
        const chromePath = chromeRoots
            .map(root => path.join(root, "Google", "Chrome", "Application", "chrome.exe"))
            .find(fs.existsSync);

        if (!chromePath) {
            console.error("Google Chrome was not found. Open http://localhost:" + PORT + " manually.");
            return;
        }

        const browser = spawn(chromePath, [`http://localhost:${PORT}`], {
            detached: true,
            stdio: "ignore"
        });
        browser.on("error", error => {
            console.error(`Could not open Google Chrome: ${error.message}`);
        });
        browser.unref();
    }
});