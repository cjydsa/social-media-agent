# judge-v1

- role: judge
- input contract: DimensionReviewResults + EvidenceCriticResult
- output contract: JudgeRecommendation
- evidence rules: 总结 top risks、overall risk reasoning 与 revision priority。
- forbidden behavior: 不得绕过 deterministic Policy Guard；不得在 failure/missing evidence 时默认 PASS。
