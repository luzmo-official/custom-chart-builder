type BasicPayload = {
  container: HTMLElement;
  data: Array<string | number>[];
  dimensions: unknown;
  language: string;
  options: unknown;
  slotConfigurations: unknown[];
  slots: unknown[];
};

type RenderPayload = BasicPayload & {
  data: Array<string | number>[];
}

export const render = ({ container, data }: RenderPayload) => {
  const wrapper = document.createElement('div');
  wrapper.className = 'chart-wrapper';
  wrapper.innerHTML = `
    <div class="chart-wrapper__title">Starter chart</div>
    <div class="chart-wrapper__content">data: ${JSON.stringify(data)}</div>
  `;

  container.appendChild(wrapper);
};

export const resize = (payload: BasicPayload) => {
  console.log('resize', payload);
};
