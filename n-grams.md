## N-Grams: How Google sees keywords and phrases

An N-gram is a contiguous sequence of N items from a given sample of text or speech. The items can be phonemes, syllables, letters, words, or base pairs according to the application. N-grams are used in various computational linguistics and natural language processing (NLP) applications.

### Types of N-grams

1. **Unigram (1-gram)**: A single item. For example, in the sentence "The cat sat on the mat," the unigrams are:
   - "The"
   - "cat"
   - "sat"
   - "on"
   - "the"
   - "mat"

2. **Bigram (2-gram)**: A sequence of two adjacent items. For the same sentence, the bigrams are:
   - "The cat"
   - "cat sat"
   - "sat on"
   - "on the"
   - "the mat"

3. **Trigram (3-gram)**: A sequence of three adjacent items. For the same sentence, the trigrams are:
   - "The cat sat"
   - "cat sat on"
   - "sat on the"
   - "on the mat"

4. **Higher-order N-grams**: Sequences with N items. For example, a 4-gram of the same sentence is:
   - "The cat sat on"
   - "cat sat on the"
   - "sat on the mat"

### Applications of N-grams

1. **Text Prediction and Autocomplete**: N-grams are used in predictive text input systems and auto-complete functionalities. For example, in a mobile keyboard, the system might use N-grams to suggest the next word based on the previous one or two words.

2. **Language Modeling**: In NLP, N-grams are used to create language models that predict the likelihood of a given sequence of words. This is useful in applications like speech recognition, machine translation, and spelling correction.

3. **Text Mining and Information Retrieval**: N-grams help in extracting meaningful patterns from text data. They are used to identify frequent terms or phrases in a corpus of documents, improving search algorithms and indexing.

4. **Sentiment Analysis**: In sentiment analysis, N-grams can capture the context of sentiments expressed in text by considering the surrounding words, which improves the accuracy of sentiment classification.

5. **Spam Detection**: By analyzing the frequency and patterns of N-grams in emails or messages, systems can detect spam or malicious content.

### Advantages and Limitations

- **Advantages**:
  - Simplicity: N-grams are simple to implement and understand.
  - Efficiency: They are computationally efficient for text processing tasks.
  - Versatility: Applicable to a wide range of NLP tasks.

- **Limitations**:
  - Data Sparsity: Higher-order N-grams require large amounts of data to provide meaningful statistics.
  - Lack of Context: N-grams do not capture long-range dependencies and context beyond the immediate sequence.
  - Fixed Length: The fixed size of N-grams might not be optimal for all linguistic phenomena.

Overall, N-grams are a foundational concept in NLP, providing a simple yet powerful tool for analyzing and modeling language data.


> A higher weight for an N-gram context suggests it appears more frequently in the document, making it more likely to be a central theme or topic. This can influence the ranking of pages that contain relevant n-grams.
https://airtable.com/app9ei8sAgiFa6YN5/shr4bNdDkpybsXQ4G/tbl1y8ib8xfdDbxLV?viewControls=on

