const https = require('https');
const fs = require('fs');

// Helper function to fetch a single batch of questions using a Promise
function fetchBatch(skip, limit) {
    return new Promise((resolve, reject) => {
        const graphqlPayload = JSON.stringify({
            query: `
            query problemsetQuestionList($limit: Int, $skip: Int) {
              problemsetQuestionList: questionList(
                categorySlug: ""
                limit: $limit
                skip: $skip
                filters: {}
              ) {
                questions: data {
                  id: questionFrontendId
                  title
                  slug: titleSlug
                  difficulty
                  topicTags {
                    name
                  }
                }
              }
            }
            `,
            variables: { skip, limit }
        });

        const options = {
            hostname: 'leetcode.com',
            path: '/graphql',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(graphqlPayload)
            }
        };

        const req = https.request(options, (res) => {
            let rawData = '';
            res.on('data', (chunk) => rawData += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(rawData);
                    resolve(parsed.data.problemsetQuestionList.questions);
                } catch (e) {
                    reject(e);
                }
            });
        });

        req.on('error', reject);
        req.write(graphqlPayload);
        req.end();
    });
}

// Main execution function
async function buildDatabase() {
    console.log("Starting full database extraction...");
    let allQuestions = [];
    let skip = 0;
    const limit = 100; // The maximum LeetCode allows per request

    // Loop until we break out manually
    while (true) {
        try {
            console.log(`Fetching questions ${skip} to ${skip + limit}...`);
            const batch = await fetchBatch(skip, limit);

            // Exit condition: The server returned no new questions
            if (batch.length === 0) {
                console.log("Reached the end of the database.");
                break;
            }

            allQuestions.push(...batch);
            skip += limit; // Increment for the next loop

        } catch (error) {
            console.error("Error fetching batch. Stopping process:", error);
            break;
        }
    }

    console.log(`Total questions fetched: ${allQuestions.length}. Formatting...`);

    // Transform all collected data
    const cleanDatabase = allQuestions.map(q => ({
        id: parseInt(q.id),
        title: q.title,
        slug: q.slug,
        difficulty: q.difficulty,
        patterns: q.topicTags.map(tag => tag.name)
    }));

    // Save the final massive array
    fs.writeFileSync('leetcode-db.json', JSON.stringify(cleanDatabase, null, 2));
    console.log("Success! Full dataset saved to leetcode-db.json");
}

// Start the extraction
buildDatabase();