import Header from '@components/Header/Header';
import style from './ProjectPage.module.css';
import Button from '@components/Button/Button';
import { projectsData } from '@/utils/projectData';
import { useState } from 'react';

const Projects = () => {
  const [activeButton, setActiveButton] = useState<number | null>(null);

  return (
    <>
      <Header title="Projects" />
      <div className={style.topMenu}>
        {projectsData.map(project => (
          <Button
            variant="styleless"
            customClass={`${style.topMenuItem} ${project.id === activeButton ? style.expand : ''}`}
            key={project.id}
            onPress={() => {
              setActiveButton(project.id);
            }}
          >
            {project.title}
          </Button>
        ))}
      </div>
    </>
  );
};

export default Projects;
