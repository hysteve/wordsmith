# Notes from Search doc Leak
https://airtable.com/app9ei8sAgiFa6YN5/shr4bNdDkpybsXQ4G/tbl1y8ib8xfdDbxLV?viewControls=on

## 10's
- Content "Quality" matters a lot
- Content optimization, keyword usage, and internal linking - Google analyzes the content's topical relevance, depth, and engagement metrics to determine its quality.
- Cache text content of your page and serve immediately - don't load text after page loads. Google indexes the site when it loads (I think)
- **THE HTML TITLE IS A 10.** Let's Talk.
  ### Truncation
  Apparently there is html title truncation that happens as part of a process. Authors can enter a stop sequence that denotes end of truncation. There's no indication (yet) of how many characters are truncated - more code doc research needed.
  "The title HTML. It may contain tags to denote query term matches. It may be already truncated and &#8220;&#8230;&#8221; is put instead (note that truncation does not always happen at the very end of the title text). However the existence of &#8220;&#8230;&#8221; does not guarantee that the snippet generation algorithm truncated it; e.g. webmasters themselves can write &#8220;&#8230;&#8221;."

  ### Query terms in title
  The HTML Title is checked by google for search query terms. This is !IMPORTANT!

  ### Choosing title
  Google wants a "concise description of the pages content". It is posting the title as the link title for search results, so it should match the query as best as possible. For this reason, the title should contain 3-5 of the strongest keywords mentioned in the linked content. The page needs to be optimized for keywords on a prioritized schedule - and the title should be gneerated from the final weighted keywords, the queries to optimize for should reflect the actual content, not popular inquiries or lead trapping.
  There may be other methods google uses for title extraction (see goldmine_page_score)

- Google's text extraction - Text elements and font size matter
"The SnapshotDocument contains a list of TextNode's. Each node contains a string of text of the webpage, its bounding box in the above snapshot image, and its font size (in the number of pixels in the snapshot, which could be a fraction number since the snapshot image is typically shrinked). This list of text nodes are extracted from the output from the rendering service: htmlrender_webkit_headless_proto.Document The extraction is done by TrimDocument defined in ./shared/doctrimmer.cc"

- Basically, stay away from photos of kids, period. Google has an internal `pedoScore` (which I suppose is a good thing), biut this one is a 10 for ranking weight. I would presume you want this to be 0 at all times.

- **QUERIES USED TO FIND THE PAGE.** This is another big 10 deserving a bit of a breakdown.

"This is the core of the search functionality. It determines the terms, filters, and other parameters used to find relevant documents. Google's algorithm analyzes the query to understand user intent and matches it with documents based on keyword relevance, freshness, quality, and other factors."

1. Googles process of finding relevant documents - very important - involves "terms, filters, and other parameters used to find relevant documents"
2. "keyword relevance, freshness, quality, and other factors."

Handling the html (or not) document - what is a "mustang repository"?

- **THE PAGE URL (URI).** This matters a lot - including keywords, and structuring it to show topical relevance.

"The URI is the foundation for Google's crawling and indexing processes. It's how Google finds, accesses, and categorizes individual pages within a website. The structure of the URI can also signal relevancy for specific keywords or topics."

Or does it?

"The URL is a unique identifier for the page, allowing Google to access, crawl, and index it. **Keywords in the URL can also be a minor ranking factor.**"

- **ROBOTS.TXT IS IMPORTANT, google looks at it**
"If a page is marked as noindex, Google will exclude it from its search results, effectively removing it from search rankings."
"Robots Info...collected from multiple sources such as HTTP headers, meta robots tags etc."
"When set to a non-zero value, the document should not be indexed or archived"

Protocol record used for collecting together all information about a document. Please consult go/dj-explorer for two basic questions about CompositeDoc: &#8211; Where should I look up certain information (e.g: pagerank, language)? &#8211; What does each field in CompositeDoc mean and who should I contact if I have questions? To add a new field into CompositeDoc, or change existing field&#8217;s size significantly, please file a ticket at go/dj-new-field, fill in necessary information and get approved by docjoin-access@ team. Next id: 194


"Snippet candidate"
"Signal scores"
"Snippet scoring"
"Ranklab features rcording"

# Backlinks (Google uses PageRank)
"A high PageRank score generally indicates that a page is linked to by many other high-quality pages, potentially leading to higher rankings."

"Directly impacts search ranking...authority and importance based on the quantity and quality of backlinks."

## Backlink Rating
see `onlineOutgoing`, `normalizedScore`
"Google considers the number of backlinks a page has, the authority of the linking sites, and the relevance of the linked content to the search query."
- # of backlinks
- "Authority" of backlinks
- Relevance of backlinks ("anchor text" used)


## Check links for dead links?
see `offlineOutgoing`
I don't know, something about this var name tells me that Google might care about any outgoing links that might be dead or "offline". This would be a handy tool to have. Include image checking, js/css, 3rd-party resource uptime. OMG I AM HAVING DEJA VU!

## Image backlinks
see `referrer`
Referrer - I call this "cooties" - if you use an image from another page, that page's reputation rubs off on you.
"Indirectly impacts search ranking by associating the image with the referring website's reputation."

## Number of Incoming/Inbound links (people who link to your page)
see `linkIncoming`, `numIncomingAnchors`
"Directly impacts search ranking by indicating the popularity and authority of a webpage based on the **quantity of inbound links**."
"Google's PageRank algorithm uses this signal as a major factor in determining a page's importance. **More backlinks from reputable websites generally lead to higher rankings.**"


## Blogs are ranked with different parameters
see `spamScore`


## Guest posts from high-ranked authors helps a lot
see `userQualityScore`
"Indirectly impacts search ranking by associating content with reputable authors, potentially boosting its credibility."


## Search Intent, Document Intent
Informational, Transactional, Navigational

----

# Domains

## Domain Age
see `spamScamUnauthoritativeSite`
"Google evaluates the authority and trustworthiness of websites using various signals, including domain age, backlinks, and content quality. If a site is deemed unauthoritative, its ranking might be affected."


## Human ratings?? 
"Stores all human ratings collected for a given entity name."
Not sure if this means Google looks for public ratings on a page, or about a page from external ratings pages, or has their own internal huma nrating system... uncelar at this time.

------
There are too many results, doing some manual searching...

# SPAM - "Penguin algorithm" - spam detection
`penguinEarlyAnchorProtected`
Google uses something called the Penguin algorithm to detect spammy content, at least to the extent of included backlinks. Having "quality" backlinks early can trigger Penguin protection, which will avoid triggering Penguin when some potentially spammy links are added later.

see `phraseAnchorSpamRate`
There appearas to be a list of anchor phrases that are associated with SPAM phrases. These are recorded and measured over time, and the rate of change is considered for rankings.
"Following signals identify spike of spammy anchor phrases. Anchors created during the spike are tagged with LINK_SPAM_PHRASE_SPIKE."


# "Rank"
Google uses this to determine the order in which knowledge panel results are displayed.

- 0-based (0-1).

see `resultsSupport` - signals supporting matching result to query


## Google may ding ranking for sites with harassment reports
see `reportHarassment`, `reportSpam`

## "VLQ" Score - a theory
Quick search, btu lines up - Google may be using some algorithmic form of the "Valued Living Questionnaire" (https://www.div12.org/wp-content/uploads/2015/06/Valued-Living-Questionnaire.pdf) - a social phsychology test.

"The Valued Living Questionnaire systematically assesses the extent to which individuals regard their values and incorporates them into daily actions"

 "It is associated with other core processes such as mindful living, acceptance, mental balance, reduced distress, and overall adjustment (Wilson & Murrell, 2004)."

How can it be used as a search engine ranking factor? I asked ChatGPT 4o (see vlq-analysis.md)


It could refer to "Variable Length Quantity", or "Vector-like Quarks" as in particle physics (probably not? are they doing quantum analysis?)

## 🚨 Big Winner - `weight`
see `weight`
"The weight of the context on the document; depends on how many times we saw the string in the document."
The number of times a string (the query string/phrase being searched for) appears in a result page matters - it's used to indicate that a larger portion of the content is realted to the query.
It's measured by N-grams.
"A higher weight for an N-gram context suggests it appears more frequently in the document, making it more likely to be a central theme or topic. This can influence the ranking of pages that contain relevant n-grams."
What is an N-Gram?
"An N-gram is a contiguous sequence of N items from a given sample of text or speech. The items can be phonemes, syllables, letters, words, or base pairs according to the application."
It's not quite a word, not quite a phrase, but an abstract set of tokens that have strong coherence.

(N-grams are interesting)[./n-grams.md].

**The order and sequence of keywords matters.**

Some Practical advice: Keyword phrases are just as important as keywords, but commonly misspelled words or phonetic spelling can also carry weight. Considering it takes a lot of power to check longer N-gram sequences, and they become less productive while being more specific, Google probably has a limitation somewhere. For practicalities sake, I would say anywhere in the range of 3 to 5 n-grams (or "combo keywords") is practical, and important to consider.

## Tofu?
see `tofu`
"Directly impacts search ranking by evaluating the trustworthiness and authority of a website's content based on various factors, including author expertise, source reputation, and fact-checking practices."

"Google uses tofu as a content quality signal to prioritize websites that provide accurate, reliable, and trustworthy information to users, combating misinformation and improving search quality."

**Ensure that you align your n-grams with high-volume queries.**

## Realtime Seismograph Boost - Ride the news cycle
Genuinely relating news to your site's main topics of focus can provide a serious injection of traffic. This isn't reliable steady traffic and it is not a strategy to hedge on, but it's a long-term play that can have huge long-term effect.

"Google's Seismograph algorithm detects spikes in interest around specific topics or events and temporarily boosts the ranking of relevant content to provide timely results."

## Include category keywords, and alternate names for the topic
see `salientCategory`, `subjectName`
"Google might use this information to understand the context of an entity and rank pages mentioning the entity higher for queries related to its salient categories, improving the relevance of search results."
"Directly impacts search quality by providing a contextually appropriate name for the entity in the news, interests, or other relevant contexts."

## Answer speific questions that appear in common queries.
see `answerScore`
"Google might use this score to rank the snippet higher if it provides a clear and accurate answer to the user's query, especially for queries seeking direct information."

## Influencing google's Dispaly Snippet?
see `displaySnippet`
"This is the final snippet displayed to users, and its quality and relevance are crucial in determining user satisfaction and click-through rates, which indirectly influence search rankings."
Is there a way to customize the snippet that gets displayed?

## Topic
see `generativeTopicPredictionFeatures`
"The inference results from the prediction services that generate the topics."


see `singleTopicness` "Signals used for mining new reference pages, set by the reference-page-scorer processor."



## Blog num articles
see `numOfArticlesByPeriods`
Google checks the number of articles a blog publishes

## Make content for conjunctions
see `conjunctions`
Google looks at conjunctions as logical operands to create more specific results - again, study queries through completions.

## Give Google subnavigation for the result
see `twoLevelScore`
This is a link score.
Make your search result take up more visual space and also make it look pro with extra decked-out info.

"This score helps Google determine which pages should be displayed under the main sitelinks in a nested format, providing users with more specific navigation options within a website."

"Represents a single sitelink target, contains basic information used to display the target (such as url and title) and to, maybe, dynamically change the way targets are selected and/or ranked (such as score and is_mobile). Please update the TargetInternal message if you make a change to this proto. See &#8220;Note on adding new fields&#8221;."


## Ranking: Don't Do

You can get taken out of results for having a shitty webpage, or, if every related result has more "authority" and strong backlinks.

"Google uses this as an internal metric to filter out low-quality pages from appearing in custom search results, potentially benefiting websites with strong backlinks and authority."
While this is mentioned in `csePagerankCutoff`, which only applies to Google Custom Search Engine (CSE), it probaly applies in a general sense as well.

## Don't clutter your site with shitty popups
see `clutterScores`
"Google algorithms detect intrusive interstitials, such as pop-ups that cover the main content, and lower the ranking of pages that use them excessively."
Suggestion: Put CTAs inline with your content to avoid popups

### Don't put shitty links on your site, it hurts everyone

### Also, don't spam phrases!
see `phraseRate`
"A high rate of spam anchor discovery might indicate ongoing link spam activities, leading Google to potentially devalue the website's backlinks and lower its ranking."

This is detecting rapid succession of links that have been identified as spam. I don't know how they identify them as spam, it may come from a blacklist, from evaluating content against anchor text, for example. 

## Careful updating a page without updating dated content - here's why
see `dateVsContentageDistributionSkew`
"Directly improves search quality by assessing the alignment between a page's date and the freshness of its content."

## Keyword positioning matters - Put keywords higher in content
see `salientPositionBoostScore`
"Google might use this score to favor snippets where salient terms (keywords relevant to the query) appear earlier in the text."
This menas you can get a ranking boost by putting phrases relevant to the query you are optimizing for, closer to the top of the page content.

see `begin` - on getting the offset for where the matched query term appeasrs in the page -
"Google uses this offset to highlight the mentioned entity in search results snippets, helping users quickly locate the relevant information. The position of the mention can also indirectly influence ranking, as mentions in prominent positions like titles or headings might be given more weight."

# Locality

- Google ranks by "Whether this result is in the same city or town that the user is in."
- It "Directly impacts local search ranking by prioritizing businesses located in the same city or town as the user."

## "Importance" factors for links
see `linkWeight`
- relevance
- trustworthiness

# User Intent, Behavior, and Sentiment Analysis

## Dwells - how long a user "dwells" on a page after clicking a search result link
see `dwells`
Google may interpret longer dwell times as a sign of relevant and engaging content, potentially boosting a page's ranking.
Indirectly impacts search ranking by measuring the time users spend on a page after clicking on it from search results, indicating engagement and satisfaction.

## Sentiment
see `sentiment`
"Google could use sentiment analysis to prioritize results that align with the user's emotional intent, for example, showing positive reviews for products when the query has a positive sentiment."
Use - Do sentiment analysis on common customer comments etc, align content with it (you can use comedy in celver sales copy to invert/align with customer intent)

## Disambiguation page - maybe a page that defines a term in the query?

## Freshness - what does it mean? What is the "FreshnessTwiddler"?
see `datesinfo`
Stores dates-related info (e.g. page is old based on its date annotations). Used in FreshnessTwiddler. Use encode/decode functions from quality/timebased/utils/dates-info-helper-inl.h

## What words is google looking at?

"confidence is a measurement of how much data we had to compute the SalientTermSet. Range: [0.0, 1.0]"


# Image
### TAG, TAG , TAG
Google looks at everything, and the more information you give about an image (meta) and the more context you give about it in the context of the page, the more likely google is going to associate it with some query, and have more signals to evaluate when ranking as a result.

> In theory, if these all reinforce each other and align well with the query, you should rank very high - not considering the factor of time and other changing variables that alster the scoring snapshots taken during Google's indexing cycles.

## Manipulated images can be removed
see `spoofScore`
"Directly impacts search ranking by identifying and filtering out images that are spoofed or manipulated to deceive viewers."

# Video
### `groundTruthTopic` (Video-related; YoutTube)
"Directly impacts ranking. This is the pre-determined, most accurate topic for the video, helping Google categorize it and match it to appropriate search queries."
"If the groundTruthTopic for a video is "vegan recipes," Google will prioritize it in search results for queries related to vegan cooking and food."

see `salientTermSet`
"Directly impacts ranking. Salient terms are the most important and relevant words or phrases in the video. Their presence in both the video and the search query indicates a strong match, boosting the video's ranking."
"A video about "electric cars" with salient terms like "Tesla," "EV charging," and "battery range" will rank higher for queries related to those specific terms, as they indicate strong relevance to the user's search intent."

## "Starburt Embeddings" - Google analyzes image data from video frames to understand the content
see `starburstV5Embeddings`
"These embeddings help Google understand the visual content of videos at a granular level, which can be used to surface relevant videos in search results."

Usage: With more understanding, this could be leveraged by including relevant static images within video content that google would be able to easily analyze and assign text tags to that align with your desired target queries.

## Bleurt score - chapters match content
see `bleurtScore`
"If a video's chapters accurately summarize the content (e.g., "Intro," "Main Argument," "Conclusion"), the high Bleurt score signals to Google that the video is well-structured and relevant to user queries."

## dolphin Score
see `dolphinScore`
"Dolphin score calculated using the question as the query, the ASR passage as the answer. See go/dolphin-models to learn more."

"Directly impacts ranking. This score assesses how well the video's answer (from the ASR) addresses the query (question). High scores indicate relevant and informative answers, boosting the video's ranking for question-based searches."

Example: "If a user searches for "How to bake a cake?", a video with a high dolphinScore answering this question comprehensively would be ranked higher than one with a vague or incomplete answer."

### Google measures a url's impressions in its search results pages
see `unquashedImpressions`
Impressions data can provide insights into how often a website appears in search results, potentially influencing its ranking.

## CTR (Click-thru rate) is important for results
see `totalClicks`
Duh, boring

## Google identifies products in search queries.
Example: "In a search for "wireless headphones with noise cancellation," this field would identify "wireless headphones" as the product."

## Googlebot cares about extraneous page resources, like javascript and css.
see `referencedResourceContent`
Google needs to analyze the content of all resources to fully understand a page.
"This field includes the actual content of resources like images, CSS, and JavaScript files. Googlebot analyzes these resources to understand how they contribute to the page's content, functionality, and user experience, all of which can influence SEO."
Advice: Performance matters (will check exactly how) - and google needing to do extra work, google probably no like. Fewer/smaller resources are better.

## Transcripts
see `videoTranscriptAnnotations`
VideoTranscriptAnnotations holds sentence segmented text and timing information to be used for VideoAnswers (go/video-answers). Note that only punctuated_transcript, timing_info, and lang field are filled, and other fields will be filled in the later stage.

## News links
see `newsVideosNewsAnchorSourceInfo`
"Google uses the information about the source of news anchors in videos to assess the credibility and authority of news content. News from reputable sources may be ranked higher in search results."

## Video Genre
Genre of the video from the page metadata. Concatenate all with a comma separator if there are multiple genres.

"A video accurately tagged as a "comedy" will rank higher for searches like "funny videos," while a video tagged as a "documentary" would be prioritized for queries about educational content."
Takeaway: the "Genre", akin to a TV/Film category, relates to the intent of the query - educational, entertainment, etc.

## Video Game Videos
Google checks specifically if a video is of a video game. 

# A Query For You - To what Extent is Google Using AI For Search? What does that mean for SEO?

Embeddings, OpenAI
https://stackoverflow.blog/2023/11/09/an-intuitive-introduction-to-text-embeddings/



# Big Takeaways

## Monitor External Links, they are like cooties
Things that can   impact you:
- they die
- they rank poorly
- they start using spam tactics
- someone they link to starts spamming
- anybody has any distasteful content whatsoever

## Focus one page on one query and one N-gram/ 


# Follow Up
- What is "Craps"? It has something to do with user behavior, clicks, click thru, and impressions.
- 