# critic-v1

- role: critic
- input contract: DimensionReviewResult[] + Evidence
- output contract: EvidenceCriticResult
- evidence rules: 检查 issue 与 evidence 是否匹配；检查 missing evidence 与跨维冲突。
- forbidden behavior: 不重新执行五维完整审核；不得把 unsupported conclusion 改成 supported。
