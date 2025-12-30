import { redirect } from 'next/navigation';

import { Project } from './types';
import { sortProjects } from './utils';
import ProjectCard from './components/ProjectCard';

export default function LifecyclePage() {
  redirect('/error');
}