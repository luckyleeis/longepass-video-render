// 자동 생성: bin/studio check (손으로 고치지 마세요)
import React from 'react';
import { TemplateProps } from '../kit/types';
import T_bar_chart from './bar_chart/BarChart';
import T_board from './board/Board';
import T_callout from './callout/Callout';
import T_card_set from './card_set/CardSet';
import T_chapter_card from './chapter_card/ChapterCard';
import T_compare from './compare/Compare';
import T_contrast from './contrast/Contrast';
import T_counter from './counter/Counter';
import T_doodle_scene from './doodle_scene/DoodleScene';
import T_flow from './flow/Flow';
import T_globe from './globe/Globe';
import T_growth_line from './growth_line/GrowthLine';
import T_headline from './headline/Headline';
import T_headline_object from './headline_object/HeadlineObject';
import T_icon_series from './icon_series/IconSeries';
import T_list from './list/List';
import T_outro from './outro/Outro';
import T_people_ratio from './people_ratio/PeopleRatio';
import T_radar from './radar/Radar';
import T_steps from './steps/Steps';
import T_taiwan_map from './taiwan_map/TaiwanMap';
import T_tiles from './tiles/Tiles';
import T_title_card from './title_card/TitleCard';

export const TEMPLATES: Record<string, React.FC<TemplateProps>> = {
  bar_chart: T_bar_chart,
  board: T_board,
  callout: T_callout,
  card_set: T_card_set,
  chapter_card: T_chapter_card,
  compare: T_compare,
  contrast: T_contrast,
  counter: T_counter,
  doodle_scene: T_doodle_scene,
  flow: T_flow,
  globe: T_globe,
  growth_line: T_growth_line,
  headline: T_headline,
  headline_object: T_headline_object,
  icon_series: T_icon_series,
  list: T_list,
  outro: T_outro,
  people_ratio: T_people_ratio,
  radar: T_radar,
  steps: T_steps,
  taiwan_map: T_taiwan_map,
  tiles: T_tiles,
  title_card: T_title_card,
};
