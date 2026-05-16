$folders = @(
  "app",
  "app\api",
  "app\api\v1",
  "app\api\v1\endpoints",
  "app\core",
  "app\models",
  "app\schemas",
  "app\services",
  "app\services\ingestion",
  "app\services\retrieval",
  "app\services\generation",
  "app\workers"
)
foreach ($f in $folders) {
  New-Item -ItemType File -Path "$f\__init__.py" -Force
}
