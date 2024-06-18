echo "Testing the '/taken' endpoint";
curl "http://localhost:3035/taken?domain=google.com"
echo "\ndone.\n"

echo "Testing the '/domains' endpoint";
curl "http://localhost:3035/domains?domain=example&categories=tech,web&suggestions=5&maxTries=20&timeout=15000&useSynonyms=true&useSameStart=false&useTriggers=true&useFollowers=false&useFollowSuffix=true"
echo "\ndone.\n"

echo "Testing the '/ranked' endpoint";
curl "http://localhost:3035/ranked?searchQuery=web%20development&json=true&pages=2&exclude=example.com"
echo "\ndone.\n"

echo "Testing the '/keywords' endpoint";
curl "http://localhost:3035/keywords?url=https://www.northwoodmushrooms.com/summer-mushroom-farm-internships&minCount=3"
echo "\ndone.\n"

echo "Testing the '/syn' endpoint";
curl "http://localhost:3035/syn?word=development&allWords=true&pretty=true&strength=2&wordType=noun"
echo "\ndone.\n"

echo "Testing the '/googled' endpoint";
curl "http://localhost:3035/googled?phrase=how%20to%20learn&ads=true&cascade=true&json=true&delay=3035"
echo "\ndone.\n"