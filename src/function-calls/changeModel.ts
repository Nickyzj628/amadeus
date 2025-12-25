const tool = {
	type: "function",
	function: {
		name: "weather",
		description: "获取指定城市的近期天气情况",
		parameters: {
			type: "object",
			properties: {
				city: {
					type: "string",
					description: "城市名称，例如：上海、哈尔滨",
				},
			},
			required: ["city"],
		},
	},
};
